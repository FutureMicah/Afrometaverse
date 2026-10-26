"""Female fighter: rigged, skinned, animated GLB with procedural textures.

Run from repo root:  python3 scripts/characters/build_female_fighter.py  [out.glb]
Then compress:       scripts/characters/compress.sh public/models/characters/female-fighter.glb
"""

from __future__ import annotations

import io
import math
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from glb_pipeline import (  # noqa: E402
    GLB,
    add_animations,
    add_skeleton,
    box,
    cap,
    clip_locomotion,
    ell,
    humanoid_skeleton,
    rigid_weights,
    sdf_mesh,
    skin_weights,
    smin,
    sph,
    tube,
)

OUT = sys.argv[1] if len(sys.argv) > 1 else "female-fighter.glb"
rng = np.random.default_rng(7)


def srgb_to_lin(c):
    return tuple(float(x) ** 2.2 for x in c)


SKIN = (0.36, 0.22, 0.14)  # deep brown sRGB base
CAMWOOD = (0.55, 0.16, 0.08)
LIP = (0.30, 0.15, 0.12)

# ------------------------------------------------------------------------------------------------
# procedural textures (tileable, returned as PNG bytes)
# ------------------------------------------------------------------------------------------------


def to_png(arr):
    im = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def tex_weave(n=256):
    """Red wrap top: fine plain weave with slub noise."""
    y, x = np.mgrid[0:n, 0:n] / n
    warp = 0.5 + 0.5 * np.sin(2 * np.pi * 64 * x)
    weft = 0.5 + 0.5 * np.sin(2 * np.pi * 64 * y)
    weave = 0.6 * warp + 0.4 * weft
    slub = rng.normal(0, 0.03, (n, n))
    base = np.array([0.56, 0.08, 0.07])
    img = base[None, None, :] * (0.78 + 0.22 * weave[..., None] + slub[..., None])
    return to_png(img)


def tex_adire(n=512):
    """Adire: indigo resist-dye on cream. Circles, chevrons and dot fields, tileable (period 1)."""
    y, x = np.mgrid[0:n, 0:n] / n
    # concentric rings on a 4x4 grid
    cx = (x * 4) % 1 - 0.5
    cy = (y * 4) % 1 - 0.5
    rr = np.sqrt(cx * cx + cy * cy)
    rings = np.sin(2 * np.pi * rr * 9) > 0.55
    # zigzag bands
    zig = np.abs(((x * 8) % 1) - 0.5) * 2 + 0.0
    zig_band = (np.abs(((y * 8 + zig * 0.5) % 1) - 0.5) < 0.08)
    # dot field
    dots = np.sqrt(((x * 16) % 1 - 0.5) ** 2 + ((y * 16) % 1 - 0.5) ** 2) < 0.07
    resist = (rings | zig_band | dots).astype(float)
    resist = np.clip(resist + rng.normal(0, 0.04, (n, n)), 0, 1)
    indigo = np.array([0.10, 0.16, 0.38])
    cream = np.array([0.90, 0.87, 0.78])
    img = indigo[None, None, :] * (1 - resist[..., None]) + cream[None, None, :] * resist[..., None]
    img *= (0.95 + 0.05 * rng.random((n, n, 1)))
    return to_png(img)


def tex_leather(n=256):
    y, x = np.mgrid[0:n, 0:n] / n
    grain = 0.5 + 0.5 * np.sin(2 * np.pi * (x * 3 + y * 0.5)) * 0.2
    noise = rng.normal(0, 0.04, (n, n))
    base = np.array([0.36, 0.20, 0.10])
    img = base[None, None, :] * (0.85 + 0.15 * grain[..., None] + noise[..., None])
    return to_png(img)


def tex_hair(n=128):
    noise = rng.normal(0, 0.05, (n, n))
    base = np.array([0.07, 0.05, 0.04])
    return to_png(base[None, None, :] + noise[..., None] * 0.5 + 0.02)


# ------------------------------------------------------------------------------------------------
# body SDF (in metres, feet at y=0, facing +Z)
# ------------------------------------------------------------------------------------------------


def torso_sdf(p):
    d = ell(p, (0, 1.26, 0.01), (0.150, 0.135, 0.100))  # chest/ribcage
    d = smin(d, ell(p, (0, 1.37, 0.0), (0.185, 0.06, 0.085)), 0.04)  # shoulders
    d = smin(d, ell(p, (0, 1.06, 0.0), (0.122, 0.085, 0.088)), 0.05)  # waist
    d = smin(d, ell(p, (0, 0.95, 0.0), (0.168, 0.105, 0.112)), 0.05)  # hips
    d = smin(d, ell(p, (0, 0.92, -0.07), (0.142, 0.09, 0.07)), 0.03)  # glutes
    for s in (-1, 1):  # bust
        d = smin(d, sph(p, (s * 0.066, 1.225, 0.082), 0.058), 0.03)
    d = smin(d, cap(p, (0, 1.40, 0), (0, 1.52, 0.005), 0.052, 0.046), 0.02)  # neck
    return d


def limbs_sdf(p):
    d = np.full(len(p), 9.0)
    for s in (-1, 1):
        # arm
        a = cap(p, (s * 0.19, 1.36, 0), (s * 0.235, 1.11, 0.02), 0.052, 0.040)
        b = cap(p, (s * 0.235, 1.11, 0.02), (s * 0.265, 0.88, 0.04), 0.038, 0.026)
        hand = ell(p, (s * 0.272, 0.82, 0.03), (0.03, 0.06, 0.018))
        d = np.minimum(d, smin(smin(a, b, 0.02), hand, 0.012))
        # leg
        thigh = cap(p, (s * 0.09, 0.95, 0), (s * 0.095, 0.52, 0.005), 0.082, 0.058)
        knee = sph(p, (s * 0.095, 0.50, 0.0), 0.055)
        calf = ell(p, (s * 0.093, 0.36, -0.012), (0.056, 0.13, 0.058))
        shin = cap(p, (s * 0.095, 0.47, 0), (s * 0.09, 0.12, 0), 0.045, 0.032)
        ankle = sph(p, (s * 0.09, 0.09, 0), 0.03)
        foot = ell(p, (s * 0.09, 0.05, 0.06), (0.045, 0.034, 0.11))
        leg = smin(thigh, knee, 0.03)
        leg = smin(leg, calf, 0.03)
        leg = smin(leg, shin, 0.02)
        leg = smin(leg, ankle, 0.02)
        leg = smin(leg, foot, 0.02)
        d = np.minimum(d, leg)
    return d


def body_sdf(p):
    return smin(torso_sdf(p), limbs_sdf(p), 0.02)


def head_sdf(p):
    """Skull, jaw, brow, cheeks, broad Nigerian-style nose base, full lips, ears."""
    d = ell(p, (0, 1.58, -0.01), (0.088, 0.112, 0.098))  # cranium
    d = smin(d, ell(p, (0, 1.555, -0.05), (0.084, 0.10, 0.07)), 0.03)  # back of skull
    d = smin(d, ell(p, (0, 1.475, 0.02), (0.068, 0.058, 0.072)), 0.04)  # jaw/chin, strong not pointed
    for s in (-1, 1):
        d = smin(d, ell(p, (s * 0.062, 1.535, 0.05), (0.034, 0.034, 0.035)), 0.03)  # cheekbones (high)
        d = np.minimum(d, ell(p, (s * 0.088, 1.56, -0.005), (0.011, 0.03, 0.02)))  # ear
    d = smin(d, ell(p, (0, 1.6, 0.082), (0.07, 0.013, 0.02)), 0.02)  # brow ridge
    d = smin(d, ell(p, (0, 1.54, 0.10), (0.017, 0.036, 0.026)), 0.02)  # nose bridge (low, not sharp)
    d = smin(d, ell(p, (0, 1.508, 0.113), (0.031, 0.02, 0.022)), 0.015)  # nose base, broad
    for s in (-1, 1):
        d = smin(d, sph(p, (s * 0.024, 1.506, 0.108), 0.011), 0.008)  # nostril wings
    d = smin(d, ell(p, (0, 1.478, 0.107), (0.028, 0.011, 0.013)), 0.01)  # upper lip, full
    d = smin(d, ell(p, (0, 1.462, 0.105), (0.031, 0.013, 0.015)), 0.01)  # lower lip, full
    for s in (-1, 1):
        d = np.maximum(d, -sph(p, (s * 0.034, 1.585, 0.078), 0.019))  # eye sockets
    return d


def eyeball_parts():
    """Eyes as separate small meshes: sclera, iris, lids are folded into the head shape."""
    return [
        ((s * 0.034, 1.585, 0.086), (0.0165, 0.0115, 0.0105)) for s in (-1, 1)
    ]


# ------------------------------------------------------------------------------------------------
# garments
# ------------------------------------------------------------------------------------------------


def shell(d, offset, thickness):
    return np.abs(d - offset) - thickness


def wrap_top_sdf(p):
    d = torso_sdf(p)
    sh = shell(d, 0.012, 0.005)
    return np.maximum(sh, np.abs(p[:, 1] - 1.18) - 0.19)  # y 0.99..1.37


def skirt_sdf(p):
    y = p[:, 1]
    t = np.clip((y - 0.30) / 0.70, 0, 1)  # 0 at hem, 1 at waist
    rx = 0.24 - 0.05 * t  # hem wider than waist
    rz = 0.18 - 0.04 * t
    e = np.sqrt((p[:, 0] / rx) ** 2 + ((p[:, 2] + 0.01) / rz) ** 2) - 1.0
    m = np.minimum(rx, rz)
    d = e * m
    sh = np.abs(d - 0.011) - 0.006
    return np.maximum(sh, np.maximum(0.30 - y, y - 1.0))


def belt_points():
    th = np.linspace(0, 2 * math.pi, 48, endpoint=False)
    return np.stack([0.14 * np.sin(th), np.full_like(th, 1.005), 0.108 * np.cos(th)], 1)


# ------------------------------------------------------------------------------------------------
# build
# ------------------------------------------------------------------------------------------------


def skin_vertex_colors(V, N):
    base = np.array(srgb_to_lin(SKIN))
    jitter = 1 + rng.normal(0, 0.03, (len(V), 1))
    C = np.clip(base[None, :] * jitter, 0, 1)
    return C.astype(np.float32)


def camwood_head(V, C):
    """Camwood (osun/camwood powder) marks: three forehead lines and two short cheek strokes."""
    cw = np.array(srgb_to_lin(CAMWOOD))
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    marks = np.zeros(len(V), bool)
    # centre forehead lines (vertical)
    for xc in (-0.024, 0.0, 0.024):
        marks |= (np.abs(x - xc) < 0.0055) & (y > 1.625) & (y < 1.665) & (z > 0.055)
    # cheek strokes: short diagonal bands from cheekbone toward jaw
    for s in (-1, 1):
        ang = np.arctan2(y - 1.53, s * (x) - s * 0.06 * 0)
        marks |= (np.abs((x * s) - 0.072 + (y - 1.53) * 0.5) < 0.0045) & (y > 1.495) & (y < 1.535) & (z > 0.04)
    C[marks] = cw
    return C


def make_glb():
    skel = humanoid_skeleton()
    g = GLB()
    joint_idx, skin_i, root = add_skeleton(g, skel)

    # textures + materials
    t_weave = g.image_png(tex_weave(), "red-wrap-weave")
    t_adire = g.image_png(tex_adire(), "adire-indigo")
    t_leather = g.image_png(tex_leather(), "leather-belt")
    m_skin = g.material("skin", (1, 1, 1, 1), metal=0.0, rough=0.62)
    m_wrap = g.material("red-wrap-top", (1, 1, 1, 1), rough=0.82, tex=t_weave)
    m_adire = g.material("adire-skirt", (1, 1, 1, 1), rough=0.78, tex=t_adire)
    m_belt = g.material("leather-belt", (1, 1, 1, 1), rough=0.55, tex=t_leather)
    m_gold = g.material("gold-bangles", (0.83, 0.62, 0.12, 1), metal=1.0, rough=0.28)
    m_steel = g.material("dagger-blade", (0.62, 0.64, 0.68, 1), metal=1.0, rough=0.32)
    m_wood = g.material("dagger-handle", (0.30, 0.17, 0.09, 1), rough=0.6)
    m_hair = g.material("hair-braids", (0.07, 0.05, 0.04, 1), rough=0.9)
    m_eyew = g.material("eye-white", (0.86, 0.84, 0.78, 1), rough=0.2)
    m_iris = g.material("iris", (0.08, 0.05, 0.03, 1), rough=0.2)

    meshes = []

    # ---- body (single skinned mesh, weights from bone segments)
    lo, hi = (-0.32, 0.03, -0.18), (0.32, 1.56, 0.18)
    Vb, Fb, Nb = sdf_mesh(body_sdf, lo, hi, 0.0105)
    Cb = skin_vertex_colors(Vb, Nb)
    Jb, Wb, _ = skin_weights(skel, Vb, sigma=0.035)
    meshes.append(("body", [dict(V=Vb, F=Fb, N=Nb, C=Cb, J=Jb, W=Wb, material=m_skin)]))

    # ---- head (rigid to Head bone, fine voxels for face detail)
    lo_h, hi_h = (-0.11, 1.36, -0.12), (0.11, 1.74, 0.13)
    Vh, Fh, Nh = sdf_mesh(head_sdf, lo_h, hi_h, 0.0022)
    Ch = camwood_head(Vh, skin_vertex_colors(Vh, Nh))
    Jh, Wh = rigid_weights(len(Vh), joint_idx["Head"])
    meshes.append(("head", [dict(V=Vh, F=Fh, N=Nh, C=Ch, J=Jh, W=Wh, material=m_skin)]))

    # ---- eyes: sclera and iris spheres (rigid to Head)
    prims = []
    for (c, r) in eyeball_parts():
        Ve, Fe, Ne = sdf_mesh(lambda p, c=c, r=r: ell(p, c, r), np.array(c) - np.array(r) - 0.004,
                              np.array(c) + np.array(r) + 0.004, 0.0012)
        Je, We = rigid_weights(len(Ve), joint_idx["Head"])
        prims.append(dict(V=Ve, F=Fe, N=Ne, J=Je, W=We, material=m_eyew))
        ic = (c[0], c[1], c[2] + r[2] * 0.52)
        Vi, Fi, Ni = sdf_mesh(lambda p, ic=ic: sph(p, ic, 0.0068), np.array(ic) - 0.009, np.array(ic) + 0.009, 0.0008)
        Ji, Wi = rigid_weights(len(Vi), joint_idx["Head"])
        prims.append(dict(V=Vi, F=Fi, N=Ni, J=Ji, W=Wi, material=m_iris))
    meshes.append(("eyes", prims))

    # ---- braided crown + hanging braids (rigid to Head)
    prims = []
    for k in range(6):
        beta = (k - 2.5) * 0.23
        pts = []
        for a in np.linspace(0.42, 2.95, 26):
            R = np.array([0.094, 0.122, 0.11])
            x = R[0] * math.sin(a) * math.sin(beta)
            y = 1.575 + R[1] * math.cos(a) + 0.012
            z = R[2] * math.sin(a) * math.cos(beta) - 0.012
            pts.append((x, y, z))
        # hang down the back of the neck
        for t in np.linspace(0, 1, 10)[1:]:
            pts.append((pts[-1][0] * (1 - 0.1 * t), pts[-1][1] - 0.05 * t * 1.2, pts[-1][2] - 0.012 * t))
        V_, F_, N_ = tube(pts, 0.0105 + 0.0015 * (k % 2), sides=7)
        Jh_, Wh_ = rigid_weights(len(V_), joint_idx["Head"])
        prims.append(dict(V=V_, F=F_, N=N_, J=Jh_, W=Wh_, material=m_hair))
    # brows
    for s in (-1, 1):
        bpts = [(s * (0.012 + 0.03 * t), 1.61 + 0.012 * math.sin(math.pi * t), 0.09) for t in np.linspace(0, 1, 8)]
        V_, F_, N_ = tube(bpts, 0.0043, sides=5)
        Jh_, Wh_ = rigid_weights(len(V_), joint_idx["Head"])
        prims.append(dict(V=V_, F=F_, N=N_, J=Jh_, W=Wh_, material=m_hair))
    meshes.append(("hair", prims))

    # ---- wrap top (cloth shell over torso, skinned to spine/arm roots)
    Vw, Fw, Nw = sdf_mesh(wrap_top_sdf, (-0.2, 0.96, -0.14), (0.2, 1.40, 0.14), 0.0095)
    ang = np.arctan2(Vw[:, 0], Vw[:, 2])
    UVw = np.stack([ang / (2 * math.pi) * 3.0, Vw[:, 1] * 4.0], 1)
    Jw, Ww, _ = skin_weights(skel, Vw, sigma=0.04)
    meshes.append(("wrap", [dict(V=Vw, F=Fw, N=Nw, UV=UVw, J=Jw, W=Ww, material=m_wrap)]))

    # ---- adire wrapper skirt
    Vs, Fs, Ns = sdf_mesh(skirt_sdf, (-0.27, 0.27, -0.22), (0.27, 1.03, 0.22), 0.0115)
    ang = np.arctan2(Vs[:, 0], Vs[:, 2])
    UVs = np.stack([ang / (2 * math.pi) * 4.0, Vs[:, 1] * 3.0], 1)
    Js, Ws, _ = skin_weights(skel, Vs, sigma=0.05)
    meshes.append(("skirt", [dict(V=Vs, F=Fs, N=Ns, UV=UVs, J=Js, W=Ws, material=m_adire)]))

    # ---- belt (tube around the waist, rigid to Hips)
    pts = belt_points()
    Vbt, Fbt, Nbt = tube(pts, 0.017, sides=10, closed=True)
    Jbt, Wbt = rigid_weights(len(Vbt), joint_idx["Hips"])
    UVbt = np.stack([np.linspace(0, 4, len(Vbt)), np.zeros(len(Vbt))], 1)
    meshes.append(("belt", [dict(V=Vbt, F=Fbt, N=Nbt, UV=UVbt, J=Jbt, W=Wbt, material=m_belt)]))

    # ---- dagger on the left hip (rigid to Hips): handle + blade
    hilt = [(0.152, 1.005, 0.07), (0.152, 1.045, 0.07)]
    Vdh, Fdh, Ndh = tube(hilt, 0.0115, sides=8)
    Jd, Wd = rigid_weights(len(Vdh), joint_idx["Hips"])
    Vdb, Fdb, Ndb = box((0.152, 0.91, 0.085), (0.024, 0.19, 0.008), rot=None)
    Jdb, Wdb = rigid_weights(len(Vdb), joint_idx["Hips"])
    meshes.append(("dagger", [
        dict(V=Vdh, F=Fdh, N=Ndh, J=Jd, W=Wd, material=m_wood),
        dict(V=Vdb, F=Fdb, N=Ndb, J=Jdb, W=Wdb, material=m_steel),
    ]))

    # ---- gold bangles: stacked rings on each forearm, rigid to ForeArm
    prims = []
    for s in (-1, 1):
        elbow = np.array([s * 0.235, 1.11, 0.02])
        wrist = np.array([s * 0.265, 0.88, 0.04])
        dvec = (wrist - elbow)
        dvec /= np.linalg.norm(dvec)
        # two axes perpendicular to the forearm
        u = np.cross(dvec, [1.0, 0, 0])
        u /= np.linalg.norm(u)
        w_ = np.cross(dvec, u)
        for k, t in enumerate([0.60, 0.65, 0.70, 0.75]):
            c = elbow + (wrist - elbow) * t
            r_forearm = 0.038 - 0.012 * t
            rad = r_forearm + 0.0055
            ring = [c + rad * (math.cos(a) * u + math.sin(a) * w_) for a in np.linspace(0, 2 * math.pi, 28, endpoint=False)]
            V_, F_, N_ = tube(ring, 0.0055, sides=6, closed=True)
            Jb_, Wb_ = rigid_weights(len(V_), joint_idx[("Left" if s == 1 else "Right") + "ForeArm"])
            prims.append(dict(V=V_, F=F_, N=N_, J=Jb_, W=Wb_, material=m_gold))
    meshes.append(("bangles", prims))

    # ---- write meshes & nodes
    for name, prims in meshes:
        mi = g.mesh(name, prims)
        n_skin = skin_i if any("J" in p for p in prims) else None
        node_kwargs = {"mesh": mi}
        if n_skin is not None:
            node_kwargs["skin"] = n_skin
        ni = g.node(name, **node_kwargs)
        g.root_nodes.append(ni)

    # ---- animations: idle, walk, run (procedural, 30 fps style keyframes)
    clips = {
        "idle": clip_locomotion("idle", skel, 48, 3.2),
        "walk": clip_locomotion("walk", skel, 32, 1.0),
        "run": clip_locomotion("run", skel, 24, 0.62),
    }
    add_animations(g, joint_idx, skel, clips)

    data = g.to_bytes()
    with open(OUT, "wb") as f:
        f.write(data)
    print(f"wrote {OUT}: {len(data)/1024:.1f} KB, meshes={len(meshes)}, anims={[a['name'] for a in g.animations]}")


if __name__ == "__main__":
    make_glb()
