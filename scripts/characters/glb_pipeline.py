"""Reusable GLB character pipeline for Afrometaverse.

No Blender needed. A character is described as:
  * signed-distance primitives (sculpted body, head, clothing, props), meshed with marching cubes
  * a Mixamo-named skeleton (Hips, Spine, Spine1, Neck, Head, Left/RightArm, ForeArm, Hand,
    UpLeg, Leg, Foot) so clips written for one character retarget to any other character that uses
    the same names
  * distance-based skin weights (top 4 bones per vertex)
  * procedural clips (idle, walk, run) baked as quaternion/translation keyframes
  * a minimal glTF 2.0 binary writer

Compression and KTX2 / WebP conversion happen afterwards in compress.sh (gltf-transform).

Units are metres, Y up, the character faces +Z, feet on y=0.
"""

from __future__ import annotations

import json
import math
import struct
from dataclasses import dataclass, field

import numpy as np
from skimage import measure

# ---------------------------------------------------------------------------------------------
# SDF helpers (all take p with shape (N, 3) and return (N,))
# ---------------------------------------------------------------------------------------------


def ell(p, c, r):
    """Ellipsoid, approximate signed distance (iq style)."""
    c = np.asarray(c, float)
    r = np.asarray(r, float)
    q = (p - c) / r
    k0 = np.linalg.norm(q, axis=-1)
    k1 = np.maximum(np.linalg.norm((p - c) / (r * r), axis=-1), 1e-9)
    return k0 * (k0 - 1.0) / k1


def sph(p, c, r):
    return np.linalg.norm(p - np.asarray(c, float), axis=-1) - r


def cap(p, a, b, ra, rb):
    """Tapered capsule from a (radius ra) to b (radius rb)."""
    a = np.asarray(a, float)
    b = np.asarray(b, float)
    pa = p - a
    ba = b - a
    h = np.clip((pa @ ba) / (ba @ ba), 0.0, 1.0)
    d = np.linalg.norm(pa - h[..., None] * ba, axis=-1)
    return d - (ra + (rb - ra) * h)


def smin(a, b, k):
    """Polynomial smooth union (k = blend radius, metres)."""
    if k <= 0:
        return np.minimum(a, b)
    h = np.maximum(k - np.abs(a - b), 0.0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def U(a, b, k=0.02):
    return smin(a, b, k)


def sdf_mesh(fn, lo, hi, h):
    """Marching cubes over the box [lo, hi] at voxel size h. Returns (verts, faces, normals)."""
    lo = np.asarray(lo, float)
    hi = np.asarray(hi, float)
    n = np.ceil((hi - lo) / h).astype(int) + 1
    xs = [lo[i] + np.arange(n[i]) * h for i in range(3)]
    grid = np.stack(np.meshgrid(*xs, indexing="ij"), -1).reshape(-1, 3)
    vals = np.empty(len(grid))
    for i in range(0, len(grid), 200_000):
        vals[i : i + 200_000] = fn(grid[i : i + 200_000])
    vol = vals.reshape(n)
    if vol.min() > 0 or vol.max() < 0:
        raise ValueError("sdf surface not inside bounds; widen lo/hi")
    verts, faces, _, _ = measure.marching_cubes(vol, level=0.0, spacing=(h, h, h))
    verts = (verts + lo).astype(float)
    return orient(fn, verts, faces.astype(np.int64))


def orient(fn, verts, faces, eps=None):
    """Outward SDF gradient normals, with consistent (CCW-outward) winding."""
    eps = eps or 1e-4
    nrm = np.zeros_like(verts)
    for k in range(3):
        d = np.zeros(3)
        d[k] = eps
        nrm[:, k] = fn(verts + d) - fn(verts - d)
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
    fnorm = np.cross(verts[faces[:, 1]] - verts[faces[:, 0]], verts[faces[:, 2]] - verts[faces[:, 0]])
    if np.sum(np.einsum("ij,ij->i", fnorm, nrm[faces].mean(1))) < 0:
        faces = faces[:, ::-1]
    return verts.astype(np.float32), np.ascontiguousarray(faces).astype(np.uint32), nrm.astype(np.float32)


def tube(points, radius, sides=8, closed=False):
    """Swept circle along a polyline. radius can be a scalar or per-point array."""
    P = np.asarray(points, float)
    n = len(P)
    T = np.gradient(P, axis=0) if not closed else np.roll(P, -1, 0) - np.roll(P, 1, 0)
    T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-12
    rad = np.full(n, radius, float) if np.isscalar(radius) else np.asarray(radius, float)
    V, N = [], []
    for i in range(n):
        t = T[i]
        a = np.array([1.0, 0, 0]) if abs(t[0]) < 0.9 else np.array([0, 1.0, 0])
        nn = np.cross(t, a)
        nn /= np.linalg.norm(nn)
        bb = np.cross(t, nn)
        for j in range(sides):
            th = 2 * math.pi * j / sides
            nv = math.cos(th) * nn + math.sin(th) * bb
            V.append(P[i] + rad[i] * nv)
            N.append(nv)
    F = []
    rows = n if closed else n - 1
    for i in range(rows):
        i2 = (i + 1) % n
        for j in range(sides):
            a = i * sides + j
            b = i * sides + (j + 1) % sides
            c = i2 * sides + j
            d = i2 * sides + (j + 1) % sides
            F += [[a, c, b], [b, c, d]]
    V = np.array(V, np.float32)
    N = np.array(N, np.float32)
    F = np.array(F, np.uint32)
    # fix winding globally against the radial normals
    fn_ = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    if np.sum(np.einsum("ij,ij->i", fn_, N[F].mean(1))) < 0:
        F = F[:, ::-1].copy()
    return V, F, N


def box(center, size, rot=None):
    """Oriented box mesh (flat normals, 24 verts)."""
    c = np.asarray(center, float)
    s = np.asarray(size, float) / 2
    rot = np.eye(3) if rot is None else np.asarray(rot, float)
    V, N, F = [], [], []
    faces = [
        ([1, 0, 0], [(1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)]),
        ([-1, 0, 0], [(-1, -1, 1), (-1, 1, 1), (-1, 1, -1), (-1, -1, -1)]),
        ([0, 1, 0], [(-1, 1, -1), (-1, 1, 1), (1, 1, 1), (1, 1, -1)]),
        ([0, -1, 0], [(-1, -1, 1), (-1, -1, -1), (1, -1, -1), (1, -1, 1)]),
        ([0, 0, 1], [(-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]),
        ([0, 0, -1], [(1, -1, -1), (-1, -1, -1), (-1, 1, -1), (1, 1, -1)]),
    ]
    for normal, corners in faces:
        base = len(V)
        for cx in corners:
            V.append(c + rot @ (np.array(cx) * s))
            N.append(rot @ np.array(normal, float))
        F += [[base, base + 1, base + 2], [base, base + 2, base + 3]]
    return np.array(V, np.float32), np.array(F, np.uint32), np.array(N, np.float32)


def rot_axis(axis, angle):
    axis = np.asarray(axis, float)
    axis /= np.linalg.norm(axis)
    x, y, z = axis
    c, s = math.cos(angle), math.sin(angle)
    C = 1 - c
    return np.array(
        [[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
         [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
         [z * x * C - y * s, z * y * C + x * s, c + z * z * C]]
    )


# ---------------------------------------------------------------------------------------------
# Skeleton
# ---------------------------------------------------------------------------------------------


@dataclass
class Skeleton:
    """Joint world positions (rest pose) and parent links. Names follow Mixamo (no prefix)."""

    joints: dict  # name -> (x, y, z)
    parents: dict  # name -> parent name (None for Hips)
    # bone segments used for skin weights: name -> (start joint, end joint)
    segments: dict = field(default_factory=dict)

    def order(self):
        return list(self.joints.keys())


def mirror(p, side):
    return (side * p[0], p[1], p[2])


def humanoid_skeleton(height_scale=1.0):
    """Realistic adult female proportions, 1.73 m. Left = +X (character's own left)."""
    J = {
        "Hips": (0, 0.95, 0),
        "Spine": (0, 1.12, 0),
        "Spine1": (0, 1.30, 0),
        "Neck": (0, 1.44, 0),
        "Head": (0, 1.48, 0),
    }
    for s, side in (("Left", 1), ("Right", -1)):
        J[s + "Arm"] = (side * 0.19, 1.36, 0)
        J[s + "ForeArm"] = (side * 0.235, 1.11, 0.02)
        J[s + "Hand"] = (side * 0.265, 0.88, 0.04)
        J[s + "UpLeg"] = (side * 0.09, 0.95, 0)
        J[s + "Leg"] = (side * 0.095, 0.50, 0.01)
        J[s + "Foot"] = (side * 0.09, 0.08, 0)
    parents = {
        "Hips": None,
        "Spine": "Hips",
        "Spine1": "Spine",
        "Neck": "Spine1",
        "Head": "Neck",
    }
    for s in ("Left", "Right"):
        parents[s + "Arm"] = "Spine1"
        parents[s + "ForeArm"] = s + "Arm"
        parents[s + "Hand"] = s + "ForeArm"
        parents[s + "UpLeg"] = "Hips"
        parents[s + "Leg"] = s + "UpLeg"
        parents[s + "Foot"] = s + "Leg"
    segs = {"Hips": ("Hips", "Spine"), "Spine": ("Spine", "Spine1"), "Spine1": ("Spine1", "Neck"),
            "Neck": ("Neck", "Head"), "Head": ("Head", None)}
    for s in ("Left", "Right"):
        segs[s + "Arm"] = (s + "Arm", s + "ForeArm")
        segs[s + "ForeArm"] = (s + "ForeArm", s + "Hand")
        segs[s + "Hand"] = (s + "Hand", None)
        segs[s + "UpLeg"] = (s + "UpLeg", s + "Leg")
        segs[s + "Leg"] = (s + "Leg", s + "Foot")
        segs[s + "Foot"] = (s + "Foot", None)
    return Skeleton(joints=J, parents=parents, segments=segs)


def seg_points(skel: Skeleton, bone: str):
    a_name, b_name = skel.segments[bone]
    a = np.array(skel.joints[a_name], float)
    if b_name is None:
        # open-ended bones: extend the tip a little along the bone direction
        par = skel.parents[a_name]
        d = a - np.array(skel.joints[par], float) if par else np.array([0, 1.0, 0])
        d = d / (np.linalg.norm(d) + 1e-9)
        b = a + d * 0.08
    else:
        b = np.array(skel.joints[b_name], float)
    return a, b


def skin_weights(skel: Skeleton, V: np.ndarray, sigma: float = 0.035):
    """Return (joints uint16 (N,4), weights float32 (N,4)). Top 4 bones by Gaussian falloff."""
    order = skel.order()
    dists = []
    for name in order:
        a, b = seg_points(skel, name)
        ba = b - a
        pa = V - a
        h = np.clip(pa @ ba / (ba @ ba), 0, 1)
        d = np.linalg.norm(pa - h[:, None] * ba, axis=1)
        dists.append(d)
    D = np.stack(dists, 1)
    logits = -(D ** 2) / (sigma ** 2)
    logits -= logits.max(1, keepdims=True)
    W = np.exp(logits)
    top = np.argsort(-W, axis=1)[:, :4]
    Wt = np.take_along_axis(W, top, 1)
    Wt /= Wt.sum(1, keepdims=True)
    return top.astype(np.uint16), Wt.astype(np.float32), order


def rigid_weights(n: int, joint_index: int):
    j = np.zeros((n, 4), np.uint16)
    w = np.zeros((n, 4), np.float32)
    j[:, 0] = joint_index
    w[:, 0] = 1.0
    return j, w


# ---------------------------------------------------------------------------------------------
# Animation (procedural clips in local rotation space)
# ---------------------------------------------------------------------------------------------


def quat_x(a):
    return [math.sin(a / 2), 0.0, 0.0, math.cos(a / 2)]


def quat_z(a):
    return [0.0, 0.0, math.sin(a / 2), math.cos(a / 2)]


def clip_locomotion(kind: str, skel: Skeleton, frames: int, period: float):
    """Return {name: {'T': times, 'R': [quat..]|None, 'Tr': [vec3]|None}} for a looping clip.

    Rotations are *deltas* from rest. Translation track on Hips is absolute (rest + delta).
    """
    if kind == "idle":
        leg, arm, knee, lean, bob = 0.02, 0.05, 0.0, 0.0, 0.004
        breathe = 0.02
    elif kind == "walk":
        leg, arm, knee, lean, bob = 0.42, 0.35, 0.55, 0.02, 0.012
        breathe = 0.0
    elif kind == "run":
        leg, arm, knee, lean, bob = 0.75, 0.7, 1.1, 0.14, 0.03
        breathe = 0.0
    else:
        raise ValueError(kind)

    times = [i * period / frames for i in range(frames + 1)]
    tracks = {}
    rest_hips = np.array(skel.joints["Hips"], float)

    def add(name, key, values):
        tracks.setdefault(name, {})[key] = values

    hipsT, spineR, spine1R = [], [], []
    legR = {"Left": [], "Right": []}
    kneeR = {"Left": [], "Right": []}
    armR = {"Left": [], "Right": []}
    foreR = {"Left": [], "Right": []}
    for i in range(frames + 1):
        ph = 2 * math.pi * i / frames
        hipsT.append(list(rest_hips + np.array([0, bob * math.cos(2 * ph) + breathe * 0.0, 0])))
        spineR.append(quat_x(lean + breathe * math.sin(ph)))
        spine1R.append(quat_x(-lean * 0.5 + breathe * math.sin(ph + 0.4)))
        for side, s in (("Left", 1), ("Right", -1)):
            swing = math.sin(ph + (0 if side == "Left" else math.pi))
            legR[side].append(quat_x(-leg * swing))
            # knee flexes while the leg swings forward
            kneeR[side].append(quat_x(-knee * max(0.0, math.sin(ph + (0 if side == "Left" else math.pi) + 1.2)) if kind != "idle" else 0.0))
            armR[side].append(quat_x(arm * swing if kind != "idle" else arm * math.sin(ph) * s))
            bend = -0.35 if kind == "walk" else (-1.25 if kind == "run" else -0.2)
            foreR[side].append(quat_x(bend))
    tracks["Hips"] = {"T": hipsT}
    tracks["Spine"] = {"R": spineR}
    tracks["Spine1"] = {"R": spine1R}
    for side in ("Left", "Right"):
        tracks[side + "UpLeg"] = {"R": legR[side]}
        tracks[side + "Leg"] = {"R": kneeR[side]}
        tracks[side + "Arm"] = {"R": armR[side]}
        tracks[side + "ForeArm"] = {"R": foreR[side]}
    return {"times": times, "tracks": tracks}


# ---------------------------------------------------------------------------------------------
# glTF 2.0 binary writer
# ---------------------------------------------------------------------------------------------

FLOAT, U16, U32, U8 = 5126, 5123, 5125, 5121
ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER = 34962, 34963
TYPE_SIZE = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


class GLB:
    def __init__(self):
        self.buf = bytearray()
        self.bviews, self.accessors = [], []
        self.images, self.textures, self.materials = [], [], []
        self.meshes, self.nodes, self.skins, self.animations = [], [], [], []
        self.samplers = [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}]
        self.root_nodes = []

    def _bview(self, data: bytes, target=None):
        pad = (-len(self.buf)) % 4
        self.buf += b"\0" * pad
        off = len(self.buf)
        self.buf += data
        bv = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target:
            bv["target"] = target
        self.bviews.append(bv)
        return len(self.bviews) - 1

    def accessor(self, arr, comp, typ, target=None, minmax=False):
        arr = np.ascontiguousarray(arr)
        bv = self._bview(arr.tobytes(), target)
        acc = {"bufferView": bv, "componentType": comp, "count": int(arr.shape[0]), "type": typ}
        if minmax:
            acc["min"] = arr.reshape(arr.shape[0], -1).min(0).tolist()
            acc["max"] = arr.reshape(arr.shape[0], -1).max(0).tolist()
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def image_png(self, png_bytes: bytes, name: str):
        bv = self._bview(png_bytes)
        self.images.append({"bufferView": bv, "mimeType": "image/png", "name": name})
        self.textures.append({"source": len(self.images) - 1, "sampler": 0})
        return len(self.textures) - 1

    def material(self, name, rgba, metal=0.0, rough=0.7, tex=None):
        pbr = {"baseColorFactor": list(rgba), "metallicFactor": metal, "roughnessFactor": rough}
        if tex is not None:
            pbr["baseColorTexture"] = {"index": tex}
        self.materials.append({"name": name, "pbrMetallicRoughness": pbr, "doubleSided": False})
        return len(self.materials) - 1

    def mesh(self, name, prims):
        """prims: list of dict(V, F, N, UV?, C?, J?, W?, material)."""
        out = []
        for p in prims:
            V = np.asarray(p["V"], np.float32)
            attrs = {"POSITION": self.accessor(V, FLOAT, "VEC3", ARRAY_BUFFER, minmax=True)}
            attrs["NORMAL"] = self.accessor(np.asarray(p["N"], np.float32), FLOAT, "VEC3", ARRAY_BUFFER)
            if p.get("UV") is not None:
                attrs["TEXCOORD_0"] = self.accessor(np.asarray(p["UV"], np.float32), FLOAT, "VEC2", ARRAY_BUFFER)
            if p.get("C") is not None:
                attrs["COLOR_0"] = self.accessor(np.asarray(p["C"], np.float32), FLOAT, "VEC3", ARRAY_BUFFER)
            if p.get("J") is not None:
                attrs["JOINTS_0"] = self.accessor(np.asarray(p["J"], np.uint16), U16, "VEC4", ARRAY_BUFFER)
                attrs["WEIGHTS_0"] = self.accessor(np.asarray(p["W"], np.float32), FLOAT, "VEC4", ARRAY_BUFFER)
            idx = self.accessor(np.asarray(p["F"], np.uint32).reshape(-1), U32, "SCALAR", ELEMENT_ARRAY_BUFFER)
            prim = {"attributes": attrs, "indices": idx, "mode": 4}
            if p.get("material") is not None:
                prim["material"] = p["material"]
            out.append(prim)
        self.meshes.append({"name": name, "primitives": out})
        return len(self.meshes) - 1

    def node(self, name, **kw):
        n = {"name": name}
        n.update(kw)
        self.nodes.append(n)
        return len(self.nodes) - 1

    def to_bytes(self):
        j = {
            "asset": {"version": "2.0", "generator": "afrometaverse glb_pipeline"},
            "scene": 0,
            "scenes": [{"nodes": self.root_nodes}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "accessors": self.accessors,
            "bufferViews": self.bviews,
            "buffers": [{"byteLength": len(self.buf)}],
            "materials": self.materials,
            "samplers": self.samplers,
        }
        if self.images:
            j["images"] = self.images
            j["textures"] = self.textures
        if self.skins:
            j["skins"] = self.skins
        if self.animations:
            j["animations"] = self.animations
        js = json.dumps(j, separators=(",", ":")).encode()
        js += b" " * ((-len(js)) % 4)
        bn = bytes(self.buf) + b"\0" * ((-len(self.buf)) % 4)
        total = 12 + 8 + len(js) + 8 + len(bn)
        out = struct.pack("<4sII", b"glTF", 2, total)
        out += struct.pack("<I4s", len(js), b"JSON") + js
        out += struct.pack("<I4s", len(bn), b"BIN\0") + bn
        return out



def add_skeleton(g: GLB, skel: Skeleton):
    """Create joint nodes and an inverse-bind accessor. Returns (joint_node_index_by_name, skin_index, root)."""
    order = skel.order()
    idx = {}
    # create nodes first (children are added after parents via explicit children lists)
    for name in order:
        par = skel.parents[name]
        if par is None:
            t = list(skel.joints[name])
        else:
            pj = np.array(skel.joints[par], float)
            cj = np.array(skel.joints[name], float)
            t = list(cj - pj)
        idx[name] = g.node(name, translation=[float(v) for v in t])
    for name in order:
        par = skel.parents[name]
        if par is not None:
            g.nodes[idx[par]].setdefault("children", []).append(idx[name])
    ibm = []
    for name in order:
        x, y, z = skel.joints[name]
        M = np.eye(4, dtype=np.float32)
        M[:3, 3] = [-x, -y, -z]
        ibm.append(M.T.reshape(-1))  # glTF is column-major
    ibm_acc = g.accessor(np.array(ibm, np.float32), FLOAT, "MAT4")
    skin = {"joints": [idx[n] for n in order], "inverseBindMatrices": ibm_acc, "skeleton": idx["Hips"]}
    g.skins.append(skin)
    root = g.node("Armature", children=[idx["Hips"]])
    g.root_nodes.append(root)
    return idx, len(g.skins) - 1, root


def add_animations(g: GLB, joint_idx: dict, skel: Skeleton, clips: dict):
    for cname, clip in clips.items():
        samplers, channels = [], []
        times = np.array(clip["times"], np.float32)
        t_acc = g.accessor(times, FLOAT, "SCALAR", minmax=True)
        for bone, tr in clip["tracks"].items():
            if bone not in joint_idx:
                continue
            if "R" in tr:
                out = g.accessor(np.array(tr["R"], np.float32), FLOAT, "VEC4")
                samplers.append({"input": t_acc, "output": out, "interpolation": "LINEAR"})
                channels.append({"sampler": len(samplers) - 1, "target": {"node": joint_idx[bone], "path": "rotation"}})
            if "T" in tr:
                out = g.accessor(np.array(tr["T"], np.float32), FLOAT, "VEC3")
                samplers.append({"input": t_acc, "output": out, "interpolation": "LINEAR"})
                channels.append({"sampler": len(samplers) - 1, "target": {"node": joint_idx[bone], "path": "translation"}})
        g.animations.append({"name": cname, "samplers": samplers, "channels": channels})
