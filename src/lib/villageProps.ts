import * as THREE from "three";
import { VILLAGE_PALETTE } from "@/lib/villagePalette";
import { PropBatch, Placer, groupMatrix, type MergedPropMesh } from "@/lib/propBatch";
import { chunkOf, type ChunkCoord } from "@/lib/chunkStreaming";

/**
 * Village props as merged geometry (see lib/propBatch.ts).
 *
 * Huts, trees, compound walls and rocks are placed per 64 m chunk, so a chunk's props merge into
 * a handful of draw calls and unload with the chunk. Dressing that is not chunk-gated (roadside
 * bushes, grain stacks, pots, fence, market mats, grass pads) is merged once for the whole village.
 *
 * Geometry, colours, materials and placement match the previous per-object components.
 */

export interface HutSpec {
  x: number;
  z: number;
  rot?: number;
  kind?: HutKind;
  style?: "thatch" | "zinc" | "round";
  wall?: string;
  w?: number;
  d?: number;
  h?: number;
}

export type TreeKind = "acacia" | "broad" | "palm";

export const VILLAGE_HUTS: HutSpec[] = [
  // Market compound (around the market square, MARKET_SQUARE)
  { kind: "family", x: -4.4, z: 3.8, style: "thatch", wall: VILLAGE_PALETTE.wallSand, w: 1.25, d: 1.1 },
  { kind: "family", x: -3.0, z: 4.4, style: "zinc", wall: VILLAGE_PALETTE.wallWarm, w: 1.35, d: 1.15, h: 1.05 },
  { kind: "granary", x: -5.2, z: 2.6, style: "thatch", wall: VILLAGE_PALETTE.wallClay, rot: 0.35, w: 1.2 },
  { kind: "round", x: -3.5, z: 2.0, style: "round", wall: VILLAGE_PALETTE.wallTan, w: 1.35, h: 1.0 },
  { kind: "family", x: -2.0, z: 3.2, style: "zinc", wall: VILLAGE_PALETTE.wallDusk, rot: -0.25 },
  { kind: "round", x: -4.8, z: 4.6, style: "round", wall: VILLAGE_PALETTE.wallOchre, w: 1.1, h: 0.9 },
  { kind: "family", x: -5.5, z: 3.5, style: "thatch", wall: VILLAGE_PALETTE.wallSand, rot: 0.6, w: 1.05 },
  // Chief's compound (CHIEF_COMPOUND, gate faces the main road)
  { kind: "chief", x: 2.8, z: -10.6, style: "thatch", wall: VILLAGE_PALETTE.wallOchre, w: 1.3, d: 1.15 },
  { kind: "round", x: 5.6, z: -11.4, style: "round", wall: VILLAGE_PALETTE.wallPale, w: 1.3, h: 1.05 },
  { kind: "family", x: 5.9, z: -8.6, style: "zinc", wall: VILLAGE_PALETTE.wallGrey, w: 1.2 },
  // Waterside / creekside (north-west shore of the pond)
  { kind: "round", x: -11.3, z: -5.4, style: "round", wall: VILLAGE_PALETTE.wallOchre, w: 1.4, h: 1.05 },
  { kind: "family", x: -10.5, z: -8.4, style: "thatch", wall: VILLAGE_PALETTE.wallClay, rot: -0.2, w: 1.25 },
  { kind: "granary", x: -11.8, z: -3.6, style: "zinc", wall: VILLAGE_PALETTE.wallDusk, w: 1.2 },
  { kind: "round", x: -8.4, z: -10.8, style: "round", wall: VILLAGE_PALETTE.wallSand, w: 1.15, h: 1.0 },
  { kind: "family", x: -5.2, z: -11.4, style: "thatch", wall: VILLAGE_PALETTE.wallClay, w: 1.1 },
  { kind: "smith", x: -2.2, z: -10.6, style: "zinc", wall: VILLAGE_PALETTE.wallGrey, rot: 0.3, w: 1.2 },
  // Port edge (PORT compound, south of the main road)
  { kind: "smith", x: 10.4, z: 5.6, style: "zinc", wall: VILLAGE_PALETTE.wallStone, w: 1.55, d: 1.25, h: 1.1 },
  { kind: "family", x: 11.8, z: 4.5, style: "thatch", wall: VILLAGE_PALETTE.wallOchre, w: 1.2 },
  { kind: "family", x: 9.7, z: 3.7, style: "zinc", wall: VILLAGE_PALETTE.wallGrey, rot: 0.3, w: 1.3 },
  { kind: "round", x: 12.4, z: 5.9, style: "round", wall: VILLAGE_PALETTE.wallWarm, w: 1.2 },
  { kind: "granary", x: 11.0, z: 6.5, style: "thatch", wall: VILLAGE_PALETTE.wallClay, rot: 0.15 },
  { kind: "family", x: 13.0, z: 4.8, style: "zinc", wall: VILLAGE_PALETTE.wallStone, w: 1.15 },
  // Farm outskirts (FARM, south-east)
  { kind: "round", x: 13.0, z: 12.6, style: "thatch", wall: VILLAGE_PALETTE.wallClay, rot: 0.4, w: 1.15 },
  { kind: "family", x: 19.0, z: 13.2, style: "zinc", wall: VILLAGE_PALETTE.wallStone, rot: -0.3, w: 1.1 },
  // Path-side, set back from the main road
  { kind: "family", x: -8.0, z: 8.0, style: "zinc", wall: VILLAGE_PALETTE.wallWarm, w: 1.35, d: 1.15, h: 1.05 },
  { kind: "family", x: -11.0, z: 3.0, style: "thatch", wall: VILLAGE_PALETTE.wallClay, rot: 0.35, w: 1.2 },
  { kind: "pavilion", x: -4.0, z: 10.5, style: "round", wall: VILLAGE_PALETTE.wallTan, w: 1.35, h: 1.0 },
  { kind: "family", x: 2.6, z: 8.0, style: "zinc", wall: VILLAGE_PALETTE.wallDusk, rot: -0.25 },
];

/** Hut footprint radius for collision (circle approximation of the walls). */
export function hutRadius(h: HutSpec): number {
  const kind = h.kind ?? (h.style === "round" ? "round" : "family");
  const def = kindDefaults(kind);
  const w = h.w ?? def.w;
  const d = h.d ?? def.d;
  if (kind === "round") return w * 0.6;
  if (kind === "pavilion") return w * 0.5;
  if (kind === "chief") return (Math.hypot(w, d) / 2) * 1.05 + 0.3;
  return (Math.hypot(w, d) / 2) * 1.05;
}

export const VILLAGE_TREES: Array<[number, number, number, TreeKind]> = [
  [-7.6, 4.2, 1.15, "broad"],
  [-1.5, 5.5, 1.0, "acacia"],
  [2.8, 5.2, 1.25, "broad"],
  [-6.5, 9.2, 1.0, "acacia"],
  [-12.5, 9.5, 1.1, "broad"],
  [-13.0, 3.0, 1.1, "palm"],
  [-16.0, -6.5, 1.2, "broad"],
  [-19.0, 4.5, 1.0, "acacia"],
  [-8.8, -14.5, 1.1, "broad"],
  [-1.8, -14.2, 1.0, "acacia"],
  [-1.0, -17.0, 1.0, "broad"],
  [9.5, -13.0, 1.2, "broad"],
  [10.0, -6.5, 1.05, "acacia"],
  [15.5, -10.5, 1.15, "broad"],
  [4.0, -16.5, 1.2, "palm"],
  [17.5, -3.5, 1.0, "palm"],
  [20.0, -7.0, 1.1, "acacia"],
  [9.5, 9.0, 1.0, "broad"],
  [6.5, 14.0, 1.1, "broad"],
  [-2.5, 14.0, 1.0, "palm"],
  [-16.5, 14.0, 1.2, "broad"],
  [20.0, 14.0, 1.0, "acacia"],
];

/** Compound rings: centre x, z, radius, post count, optional gate angle (radians, x=cos z=sin). */
export const VILLAGE_WALLS: Array<[number, number, number, number, number?]> = [
  [-3.8, 3.4, 2.5, 12, -Math.PI / 2],
  [4.0, -10.0, 3.2, 14, Math.PI / 2],
  [11.2, 5.2, 3.2, 12, -Math.PI / 2],
];

/** Hearths: x, z. Shared by the scene render and collision. */
export const VILLAGE_HEARTHS: ReadonlyArray<readonly [number, number]> = [
  [-5.4, 4.6],
  [2.2, -9.2],
];

/** Heritage compounds at the outer edge: x, z, collision radius. */
export const VILLAGE_HERITAGE: ReadonlyArray<{ x: number; z: number; r: number }> = [
  { x: -17.5, z: 7.0, r: 1.7 },
  { x: 16.5, z: -7.0, r: 1.7 },
];

/** Rocks: x, z, scale. */
export const VILLAGE_ROCKS: Array<[number, number, number]> = [
  [-16.5, -10.5, 1.3],
  [-9.2, -14.0, 0.9],
  [-14.0, 8.0, 0.9],
  [10.5, -4.5, 1.0],
  [18.5, -11.0, 1.1],
  [3.0, 15.0, 0.7],
  [9.0, 18.0, 1.0],
  [-20.0, -4.5, 1.0],
];

const GRAIN_STACKS: Array<[number, number]> = [
  [-3.2, 2.8],
  [-4.6, 3.2],
  [-9.0, -3.0],
  [1.0, -3.0],
  [6.0, 7.0],
  [15.5, 14.0],
  [17.0, 14.5],
];

/** Clay pots: x, z, scale. */
const CLAY_POTS: Array<[number, number, number]> = [
  [-4.0, 3.5, 1],
  [-4.15, 3.35, 0.8],
  [-1.0, -3.0, 1],
  [-10.0, -4.2, 1.15],
  [5.0, 3.2, 1],
  [0.6, -4.6, 0.9],
];

const MARKET_MATS: Array<[number, number]> = [
  [-3.4, 3.15],
  [-2.4, 3.45],
  [-4.0, 2.7],
  [-2.9, 2.5],
];
const MARKET_MAT_LEGS: ReadonlyArray<readonly [number, number]> = [
  [-0.38, 0.15],
  [0.38, 0.15],
  [-0.38, -0.15],
  [0.38, -0.15],
];

const GRASS_PAD_POINTS: Array<[number, number]> = [
  [-5.5, 1.5],
  [-1.0, 4.0],
  [2.0, -4.2],
  [7.0, 0.5],
  [-7.5, -0.5],
  [3.0, 1.0],
  [-8.0, 3.0],
  [4.5, -2.5],
  [0.0, 5.5],
  [-2.0, -4.5],
];

/** Roadside bush corridors along the laterite roads: x, z, scale. */
function roadsideBushes(): Array<[number, number, number]> {
  const b: Array<[number, number, number]> = [];
  // along main E-W road
  for (let x = -12; x <= 12; x += 1.1) {
    b.push([x, 1.35, 0.7 + (Math.abs(x) % 3) * 0.08]);
    b.push([x + 0.4, -1.0, 0.65 + (Math.abs(x) % 2) * 0.1]);
  }
  // market road
  for (let x = -8; x <= 6; x += 1.3) {
    b.push([x, 5.7, 0.75]);
    b.push([x + 0.5, 4.0, 0.6]);
  }
  // south road
  for (let x = -8; x <= 7; x += 1.25) {
    b.push([x, -3.7, 0.7]);
    b.push([x, -2.0, 0.55]);
  }
  // N-S roads
  for (let z = -8; z <= 8; z += 1.2) {
    b.push([-4.1, z, 0.65]);
    b.push([-2.3, z + 0.3, 0.6]);
    b.push([1.9, z, 0.7]);
    b.push([3.6, z + 0.2, 0.55]);
    b.push([4.6, z, 0.6]);
    b.push([6.4, z + 0.15, 0.65]);
    b.push([-6.4, z, 0.7]);
    b.push([-4.7, z + 0.25, 0.55]);
  }
  return b;
}

export function addBush(batch: PropBatch, x: number, z: number, sc: number): void {
  const p = new Placer(batch, groupMatrix([x, 0, z], 0, [sc, sc, sc]));
  const spec = { roughness: 0.95, castShadow: true };
  p.part(new THREE.SphereGeometry(0.32, 7, 7), VILLAGE_PALETTE.leafDeep, [0, 0.28, 0], undefined, undefined, spec);
  p.part(new THREE.SphereGeometry(0.22, 6, 6), VILLAGE_PALETTE.leafMid, [0.18, 0.22, 0.1], undefined, undefined, spec);
  p.part(new THREE.SphereGeometry(0.2, 6, 6), VILLAGE_PALETTE.leafShadow, [-0.14, 0.2, -0.08], undefined, undefined, spec);
}

export function addRock(batch: PropBatch, x: number, z: number, s: number): void {
  const p = new Placer(batch);
  p.part(
    new THREE.DodecahedronGeometry(0.35, 0),
    VILLAGE_PALETTE.rockBase,
    [x, 0.12 * s, z],
    [0.1, s * 2.1, 0.05],
    [s, s * 0.7, s],
    { roughness: 0.95, castShadow: true, receiveShadow: true },
  );
}

function addGrain(batch: PropBatch, x: number, z: number): void {
  const p = new Placer(batch, groupMatrix([x, 0, z]));
  p.part(new THREE.CylinderGeometry(0.35, 0.42, 0.7, 10), VILLAGE_PALETTE.straw, [0, 0.35, 0], undefined, undefined, { castShadow: true });
  p.part(new THREE.ConeGeometry(0.38, 0.25, 10), VILLAGE_PALETTE.strawDark, [0, 0.75, 0]);
}

function addPot(batch: PropBatch, x: number, z: number, s: number): void {
  new Placer(batch).part(new THREE.SphereGeometry(0.12, 8, 8), VILLAGE_PALETTE.clayPot, [x, 0.12 * s, z], undefined, [s, s, s], {
    roughness: 0.85,
    castShadow: true,
  });
}

/** True when wall segment i (post i to i+1) sits on the gate angle, so the gap stays open. */
export function segmentIsGate(i: number, segments: number, gate: number): boolean {
  const mid = ((i + 0.5) / segments) * Math.PI * 2;
  const d = Math.abs(Math.atan2(Math.sin(mid - gate), Math.cos(mid - gate)));
  return d < Math.PI / segments;
}

export function addCompoundWall(batch: PropBatch, x: number, z: number, radius: number, segments: number, gate?: number): void {
  const p = new Placer(batch);
  const posts = Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    return [x + Math.cos(a) * radius, z + Math.sin(a) * radius] as const;
  });
  posts.forEach(([px, pz], i) => {
    if (gate !== undefined && segmentIsGate(i, segments, gate)) return;
    const [qx, qz] = posts[(i + 1) % posts.length]!;
    const len = Math.hypot(qx - px, qz - pz);
    const ang = Math.atan2(qx - px, qz - pz);
    p.part(
      new THREE.BoxGeometry(0.14, 0.85, len * 0.95),
      VILLAGE_PALETTE.wallSand,
      [(px + qx) / 2, 0.4, (pz + qz) / 2],
      [0, ang, 0],
      undefined,
      { roughness: 0.98, castShadow: true, receiveShadow: true },
    );
  });
}

/** Deterministic 0..1 value from three numbers (geometry jitter, so every player sees the same village). */
function hash3(a: number, b: number, c: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

type V3 = [number, number, number];

/** Two triangles from a quad, emitted in both windings so the face shows from any side. */
function doubleQuad(a: V3, b: V3, c: V3, d: V3): V3[] {
  return [a, b, c, a, c, d, a, c, b, a, d, c];
}

/** Two triangles, emitted in both windings. */
function doubleTri(a: V3, b: V3, c: V3): V3[] {
  return [a, b, c, a, c, b];
}

/** Metres per texture repeat for mud and thatch (the 2K maps then carry about 1 px per 1 mm). */
const TILE_M = 1.8;

function triGeometry(verts: V3[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts.flat(), 3));
  g.computeVertexNormals();
  // planar UVs on the slope: u across the roof, v up the slope, so straw courses run level
  const uv: number[] = [];
  for (const [x, y, z] of verts) uv.push((x + z) / TILE_M, y / TILE_M);
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** Scale the UVs a primitive already has (cylinders keep a seamless 0..1 wrap). */
function scaleUV(geo: THREE.BufferGeometry, sx: number, sy: number): THREE.BufferGeometry {
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  uv.needsUpdate = true;
  return geo;
}

/**
 * Per-vertex brightness: damp base and wear. `fn` gets the normalised height t (0 at the bottom, 1 at
 * the top) and returns a multiplier. Folded into vertex colour when the batch merges.
 */
function shadeByHeight(geo: THREE.BufferGeometry, fn: (t: number, x: number, z: number) => number): THREE.BufferGeometry {
  geo.computeBoundingBox();
  const bb = geo.boundingBox ?? new THREE.Box3();
  const y0 = bb.min.y;
  const span = bb.max.y - bb.min.y || 1;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const tone = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) tone[i] = fn((pos.getY(i) - y0) / span, pos.getX(i), pos.getZ(i));
  geo.setAttribute("tone", new THREE.BufferAttribute(tone, 1));
  return geo;
}

/** Sun-faded wall shading: a darker, damp base that rises up the wall and a few stains. */
function wallShade(damp: number, seed: number): (t: number, x: number, z: number) => number {
  return (t, x, z) => {
    const rise = damp + (1 - damp) * smooth01(0.02, 0.3, t);
    const stain = 1 - 0.05 * smooth01(0.4, 0.9, hash3(Math.floor(x * 9), Math.floor(t * 14), seed));
    return rise * stain;
  };
}

/** Thatch wear: eaves and the lower courses go dark with weather; the top stays bright. */
function thatchShade(seed: number): (t: number, x: number, z: number) => number {
  return (t, x, z) => {
    const eave = 0.72 + 0.28 * smooth01(0.0, 0.35, t);
    const mottle = 0.94 + 0.06 * hash3(Math.floor((x + z) * 6), Math.floor(t * 10), seed + 3);
    return eave * mottle;
  };
}

function smooth01(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Hipped thatch roof: four sloped faces meeting at a short ridge along x.
 * Eave base is at y=0 (the caller places it on the walls), apex at y=height.
 * Each face is a small grid, not one quad: rafters sit every ~0.3 m along the slope and the thatch
 * dips slightly between them, so the courses sag like real palm thatch instead of lying flat.
 */
function hipRoof(hw: number, hd: number, height: number, seed: number): { faces: THREE.BufferGeometry; ends: THREE.BufferGeometry } {
  const ridge = Math.max(0, hw - hd) * 0.6;
  const FL: V3 = [-hw, 0, hd];
  const FR: V3 = [hw, 0, hd];
  const BR: V3 = [hw, 0, -hd];
  const BL: V3 = [-hw, 0, -hd];
  const R1: V3 = [-ridge, height, 0];
  const R2: V3 = [ridge, height, 0];
  const front = sagFace(FL, FR, R1, R2, hw, height, seed);
  const back = sagFace(BL, BR, R1, R2, hw, height, seed + 1);
  return {
    faces: frondRoofUV(triGeometry([...front, ...back]), height, ridge),
    ends: frondRoofUV(triGeometry([...doubleTri(FR, BR, R2), ...doubleTri(BL, FL, R1)]), height, ridge),
  };
}

/** One sloped face as a sagging grid (eave a..b at the bottom, ridge c..d at the top). Returns both-sided tris. */
function sagFace(a: V3, b: V3, c: V3, d: V3, hw: number, height: number, seed: number): V3[] {
  const rafters = Math.max(2, Math.round((2 * hw) / 0.3));
  const nS = rafters * 2;
  const nT = 3;
  const sag = 0.18;
  const lerp3 = (p: V3, q: V3, k: number): V3 => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
  const P = (i: number, j: number): V3 => {
    const s = i / nS;
    const t = j / nT;
    const q = lerp3(lerp3(a, b, s), lerp3(c, d, s), t);
    // dip between rafters (zero on each rafter, deepest midway), fading to nothing at the ridge
    const between = Math.sin(Math.PI * ((s * rafters) % 1));
    const dip = sag * between * (1 - t * 0.85);
    // broken, uneven layer edges: small per-vertex wobble
    const j2 = (hash3(i, j, seed) - 0.5) * 0.02;
    return [q[0], q[1] - dip + j2, q[2]];
  };
  const out: V3[] = [];
  for (let i = 0; i < nS; i++) {
    for (let j = 0; j < nT; j++) {
      const p00 = P(i, j);
      const p10 = P(i + 1, j);
      const p11 = P(i + 1, j + 1);
      const p01 = P(i, j + 1);
      out.push(...doubleQuad(p00, p10, p11, p01));
    }
  }
  void height;
  return out;
}

/**
 * Loose frond strands hanging off the eave: a skirt of thin tapered strips along all four edges, so the
 * roof edge reads as individual hanging strands instead of a hard polygon line. Local space, eave at y=0.
 */
function eaveFringe(hw: number, hd: number, seed: number): THREE.BufferGeometry {
  const verts: V3[] = [];
  // one strand: a thin tapered triangle whose width runs along the edge tangent, so it reads from any side
  const strand = (root: V3, dir: V3, len: number, tan: V3) => {
    const w = 0.011;
    const tip: V3 = [root[0] + dir[0] * len, root[1] + dir[1] * len, root[2] + dir[2] * len];
    verts.push(...doubleTri([root[0] - tan[0] * w, root[1] - tan[1] * w, root[2] - tan[2] * w], [root[0] + tan[0] * w, root[1] + tan[1] * w, root[2] + tan[2] * w], tip));
  };
  const edge = (count: number, pos: (k: number, r: number) => V3, out: V3, tan: V3, tag: number) => {
    for (let k = 0; k < count; k++) {
      const r = hash3(k, tag, seed);
      const root = pos(k, r);
      // most strands hang down and out; about one in five is long and loose, sticking out from the eave
      const loose = hash3(k, tag + 7, seed) > 0.8;
      const len = loose ? 0.16 + r * 0.1 : 0.06 + r * 0.07;
      const spread = (hash3(k, tag + 3, seed) - 0.5) * 0.25;
      const dir: V3 = [out[0] + tan[0] * spread, -0.75 - r * 0.2, out[2] + tan[2] * spread];
      const n = Math.hypot(dir[0], dir[1], dir[2]);
      strand(root, [dir[0] / n, dir[1] / n, dir[2] / n], len, tan);
    }
  };
  const nF = Math.max(6, Math.round((2 * hw) / 0.09));
  const nS = Math.max(4, Math.round((2 * hd) / 0.09));
  const alongX = (k: number, r: number, nn: number, z: number): V3 => [-hw + ((k + 0.2 + r * 0.6) / nn) * 2 * hw, -0.01, z];
  const alongZ = (k: number, r: number, nn: number, x: number): V3 => [x, -0.01, -hd + ((k + 0.2 + r * 0.6) / nn) * 2 * hd];
  edge(nF, (k, r) => alongX(k, r, nF, hd + 0.01), [0, 0, 0.6], [1, 0, 0], 1);
  edge(nF, (k, r) => alongX(k, r, nF, -hd - 0.01), [0, 0, -0.6], [1, 0, 0], 2);
  edge(nS, (k, r) => alongZ(k, r, nS, hw + 0.01), [0.6, 0, 0], [0, 0, 1], 3);
  edge(nS, (k, r) => alongZ(k, r, nS, -hw - 0.01), [-0.6, 0, 0], [0, 0, 1], 4);
  return triGeometry(verts);
}

/**
 * Palm-frond UVs for a sloped roof face. u runs across the roof (x), v runs DOWN the slope: v is
 * the distance from the ridge measured along the pitch, so the frond spines fall from ridge to
 * eave instead of lying level. Every frond course therefore stacks down the roof like shingles.
 */
function frondRoofUV(geo: THREE.BufferGeometry, height: number, ridge: number): THREE.BufferGeometry {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // distance from the ridge line along the slope: pitch drop plus horizontal run from the ridge
    const run = Math.max(Math.abs(z), Math.max(0, Math.abs(x) - ridge));
    const pitch = Math.hypot(height - y, run);
    uv[i * 2] = x / TILE_M;
    uv[i * 2 + 1] = pitch / TILE_M;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

/**
 * Warp geometry vertices in place. fn receives (x, y, z) in geometry space and t, the normalised
 * height (0 at the bottom, 1 at the top), and returns the new position. Normals are recomputed.
 */
function warp(geo: THREE.BufferGeometry, fn: (x: number, y: number, z: number, t: number) => V3): THREE.BufferGeometry {
  geo.computeBoundingBox();
  const bb = geo.boundingBox ?? new THREE.Box3();
  const y0 = bb.min.y;
  const span = bb.max.y - bb.min.y || 1;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const [nx, ny, nz] = fn(x, y, z, (y - y0) / span);
    pos.setXYZ(i, nx, ny, nz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Rectangular mud wall: bulges mid-height, leans a little, with a hand-troweled wobble. Centred on its origin. */
function mudWall(w: number, h: number, d: number, bulge: number, lean: number, seed: number, damp = 0.82): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, 3, 5, 2);
  warp(g, (x, y, z, t) => {
    const s = Math.sin(Math.PI * t);
    const j = (hash3(x, y, z + seed) - 0.5) * 0.024;
    return [x * (1 + bulge * s * 0.5) + lean * t + j, y, z * (1 + bulge * s * 0.4) + j];
  });
  return planarUV(shadeByHeight(g, wallShade(damp, seed)));
}

/** Planar UVs for boxes and warped boxes: wall faces run along x+z and y, at TILE_M per repeat. */
function planarUV(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + pos.getZ(i)) / TILE_M;
    uv[i * 2 + 1] = pos.getY(i) / TILE_M;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Round mud wall (a batter that narrows slightly toward the top), bulged and slightly irregular. */
function roundWall(R: number, h: number, seg: number, bulge: number, seed: number, damp = 0.82): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(R * 0.93, R, h, seg, 4, false);
  warp(g, (x, y, z, t) => {
    const a = Math.atan2(z, x);
    const s = Math.sin(Math.PI * t);
    const k = (1 + bulge * s) * (1 + (hash3(a * 4, t * 9, seed) - 0.5) * 0.05);
    return [x * k, y, z * k];
  });
  const circ = 2 * Math.PI * R;
  return shadeByHeight(scaleUV(g, Math.max(1, Math.round(circ / TILE_M)), Math.max(1, h / TILE_M)), wallShade(damp, seed));
}

/** Open thatch cone with a hand-tied, scalloped eave. Bottom at y=-h/2, top at y=+h/2. */
function thatchCone(rBot: number, rTop: number, H: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, H, 12, 3, true);
  warp(g, (x, y, z, t) => {
    const a = Math.atan2(z, x);
    const eave = 1 + 0.05 * Math.abs(Math.sin(a * 9)) * Math.max(0, 1 - t / 0.25);
    const j = 1 + (hash3(a * 3, t * 5, seed) - 0.5) * 0.025;
    const k = eave * j;
    return [x * k, y, z * k];
  });
  const circ = 2 * Math.PI * Math.max(rBot, rTop);
  return shadeByHeight(scaleUV(g, Math.max(1, Math.round(circ / TILE_M)), Math.max(1, H / TILE_M)), thatchShade(seed));
}

/** Material set for thatch and mud; kept as palette colours so the village stays one merged draw per class. */
const SHELL = { roughness: 0.98, castShadow: true, receiveShadow: true, surface: "mud" as const };
const THATCH_SPEC = { roughness: 0.98, castShadow: true, surface: "thatch" as const };

interface HutCtx {
  p: Placer;
  wall: string;
  seed: number;
  w: number;
  d: number;
  h: number;
}

function wallTone(wall: string, seed: number): string {
  // sun-bleach: each building's walls drift toward pale clay by its own amount (0..0.3)
  const rTone = hash3(seed, 4, 1);
  return `#${new THREE.Color(wall).lerp(new THREE.Color(VILLAGE_PALETTE.wallPale), rTone * 0.3).getHexString()}`;
}

/** Per-building damp base: 0.7 (very damp, dark plinth) to 0.92 (dry). */
function dampFor(seed: number): number {
  return 0.7 + hash3(seed, 6, 2) * 0.22;
}

/** Door: planked panel, battens, side jambs and a visible lintel. Front face at frontZ. */
function doorway(c: HutCtx, frontZ: number, baseY: number, doorH: number, dx: number): void {
  const { p, seed } = c;
  const T = VILLAGE_PALETTE;
  const doorW = 0.3 + hash3(seed, 1, 2) * 0.12;
  p.part(new THREE.BoxGeometry(doorW, doorH, 0.03), T.doorWood, [dx, baseY + doorH / 2, frontZ + 0.01]);
  for (const f of [0.35, 0.7]) {
    p.part(new THREE.BoxGeometry(doorW * 0.9, 0.04, 0.035), T.timberDark, [dx, baseY + doorH * f, frontZ + 0.025]);
  }
  for (const s of [-1, 1]) {
    p.part(new THREE.BoxGeometry(0.07, doorH + 0.06, 0.08), T.timberDark, [dx + s * (doorW / 2 + 0.03), baseY + (doorH + 0.06) / 2, frontZ + 0.02]);
  }
  p.part(new THREE.BoxGeometry(doorW + 0.18, 0.09, 0.1), T.timberDark, [dx, baseY + doorH + 0.05, frontZ + 0.03]);
}

/** Birds-nest ridge cap: irregular clumps of frond ends tied along the ridge, each one leaning a different way. */
function ridgeNest(ridge: number, seed: number): THREE.BufferGeometry {
  const verts: V3[] = [];
  const strands = 14;
  for (let k = 0; k < strands; k++) {
    const r = hash3(k, 1, seed);
    const r2 = hash3(k, 2, seed);
    // strands spread irregularly along the ridge, each leaning out and drooping over the slope
    const x = -ridge - 0.12 + r * (2 * ridge + 0.24);
    const side = r2 < 0.5 ? -1 : 1;
    const reach = 0.12 + hash3(k, 3, seed) * 0.16;
    const sag = 0.02 + hash3(k, 4, seed) * 0.05;
    const root: V3 = [x, 0.02, side * 0.03];
    const tip: V3 = [x + (hash3(k, 5, seed) - 0.5) * 0.22, Math.max(0, 0.015 - sag * 0.4), side * (0.03 + reach * 1.4)];
    const mid: V3 = [(root[0] + tip[0]) / 2, 0.03 + hash3(k, 6, seed) * 0.02, (root[2] + tip[2]) / 2];
    verts.push(...doubleTri([root[0] - 0.008, root[1], root[2]], [root[0] + 0.008, root[1], root[2]], mid));
    verts.push(...doubleTri([mid[0] - 0.007, mid[1], mid[2]], [mid[0] + 0.007, mid[1], mid[2]], tip));
  }
  return triGeometry(verts);
}

/** Stick-frame reinforcement: two upright timber poles and a tie-beam pinned to a mud wall face (local space). */
function stickFrame(p: Placer, w: number, h: number, frontZ: number, seed: number): void {
  const T = VILLAGE_PALETTE;
  const xs = [-w * 0.38, w * 0.38];
  for (const x of xs) {
    p.part(new THREE.BoxGeometry(0.04, h * 0.92, 0.035), T.postWood, [x, 0.22 + h * 0.5, frontZ + 0.02], undefined, undefined, { castShadow: true });
  }
  p.part(new THREE.BoxGeometry(w * 0.76, 0.035, 0.03), T.timberDark, [0, 0.22 + h * 0.66, frontZ + 0.025], undefined, undefined, { castShadow: true });
  void seed;
}

/** Thick layered hip roof: sloping thatch, a rolled eave board on all four sides, and a rounded ridge cap. */
function hipRoofThick(p: Placer, hw: number, hd: number, H: number, base: number, seed = 0): void {
  const T = VILLAGE_PALETTE;
  const r = hipRoof(hw, hd, H, seed);
  // loose strands hang off all four eaves so the roof edge reads as frond ends, not a polygon line
  p.part(eaveFringe(hw, hd, seed), T.thatchDark, [0, base, 0], undefined, undefined, THATCH_SPEC);
  p.part(r.faces, T.thatch, [0, base, 0], undefined, undefined, THATCH_SPEC);
  p.part(r.ends, T.thatchDark, [0, base, 0], undefined, undefined, THATCH_SPEC);
  p.part(new THREE.BoxGeometry(2 * hw + 0.06, 0.07, 0.08), T.thatchDark, [0, base + 0.03, hd], undefined, undefined, THATCH_SPEC);
  p.part(new THREE.BoxGeometry(2 * hw + 0.06, 0.07, 0.08), T.thatchDark, [0, base + 0.03, -hd], undefined, undefined, THATCH_SPEC);
  p.part(new THREE.BoxGeometry(0.08, 0.07, 2 * hd + 0.06), T.thatchDark, [hw, base + 0.03, 0], undefined, undefined, THATCH_SPEC);
  p.part(new THREE.BoxGeometry(0.08, 0.07, 2 * hd + 0.06), T.thatchDark, [-hw, base + 0.03, 0], undefined, undefined, THATCH_SPEC);
  const ridge = Math.max(0, hw - hd) * 0.6;
  // birds-nest ridge cap: a tangle of tufted frond ends, not a smooth pipe
  p.part(ridgeNest(ridge, seed), T.thatchDark, [0, base + H, 0], undefined, undefined, THATCH_SPEC);
}

/** Round thatched hut: a bulged mud ring with a coping course, a tall layered thatch cone with rolled eave and tie rings. */
function buildRound(c: HutCtx): void {
  const { p, seed, wall, h } = c;
  const T = VILLAGE_PALETTE;
  const R = c.w * 0.55;
  const top = 0.22 + h;
  p.part(new THREE.CylinderGeometry(R * 1.08, R * 1.12, 0.22, 12), T.wallStone, [0, 0.11, 0], undefined, undefined, { roughness: 1, receiveShadow: true });
  p.part(roundWall(R, h, 12, 0.05, seed, dampFor(seed)), wallTone(wall, seed), [0, 0.22 + h / 2, 0], undefined, undefined, SHELL);
  p.part(new THREE.TorusGeometry(R * 0.95, 0.05, 4, 14), T.wallLight, [0, top - 0.02, 0], [Math.PI / 2, 0, 0], undefined, { roughness: 0.95 });
  doorway(c, R * 1.05 + 0.01, 0.22, h * 0.6, 0);

  const rBot = R + 0.3;
  const H = 1.0 + R * 0.5;
  const base = top - 0.04;
  p.part(thatchCone(rBot, 0.1, H, seed), T.thatch, [0, base + H / 2, 0], undefined, undefined, THATCH_SPEC);
  p.part(thatchCone(rBot + 0.1, rBot * 0.7, 0.28, seed + 5), T.thatchDark, [0, base + 0.14, 0], undefined, undefined, THATCH_SPEC);
  p.part(new THREE.TorusGeometry(rBot, 0.05, 4, 14), T.thatchDark, [0, base + 0.03, 0], [Math.PI / 2, 0, 0], undefined, THATCH_SPEC);
  for (const t of [0.35, 0.68]) {
    const r = rBot * (1 - t) + 0.1 * t;
    p.part(new THREE.TorusGeometry(r * 0.99, 0.02, 3, 14), T.thatchDark, [0, base + H * t, 0], [Math.PI / 2, 0, 0]);
  }
  p.part(new THREE.SphereGeometry(0.1, 6, 5), T.thatchDark, [0, base + H + 0.02, 0], undefined, [1, 0.7, 1], THATCH_SPEC);
  p.part(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 4), T.timberDark, [0, base + H + 0.14, 0]);
}

/** Rectangular family compound house: bulged mud walls, thick coping, hip roof with overhang, optional porch. */
function buildFamily(c: HutCtx): void {
  const { p, seed, wall, w, d, h } = c;
  const T = VILLAGE_PALETTE;
  const lean = (hash3(seed, 7, 3) - 0.5) * 0.06;
  // packed-earth skirt: darker than the wall and slightly wider, so the base reads as trodden ground
  p.part(new THREE.BoxGeometry(w * 1.1, 0.24, d * 1.1), T.packedEarth, [0, 0.12, 0], undefined, undefined, { roughness: 1, receiveShadow: true });
  p.part(mudWall(w, h, d, 0.05, lean, seed, dampFor(seed)), wallTone(wall, seed), [0, 0.22 + h / 2, 0], undefined, undefined, SHELL);
  const top = 0.22 + h;
  // stick-frame posts show on about half the family houses
  if (hash3(seed, 8, 4) > 0.5) stickFrame(p, w, h, (d / 2) * 1.03, seed);
  p.part(new THREE.BoxGeometry(w + 0.06, 0.07, d + 0.06), T.wallLight, [0, top - 0.02, 0], undefined, undefined, { roughness: 0.95, castShadow: true });
  const frontZ = (d / 2) * 1.03;
  doorway(c, frontZ, 0.22, h * 0.62, (hash3(seed, 2, 2) - 0.5) * w * 0.2);
  if (hash3(seed, 3, 3) > 0.5) {
    const wx = (hash3(seed, 6, 6) - 0.5) * w * 0.4;
    p.part(new THREE.BoxGeometry(0.2, 0.18, 0.03), T.windowDark, [wx, 0.22 + h * 0.6, -frontZ - 0.01]);
    p.part(new THREE.BoxGeometry(0.26, 0.04, 0.06), T.timberDark, [wx, 0.22 + h * 0.6 - 0.11, -frontZ - 0.02]);
  }
  hipRoofThick(p, w / 2 + 0.26, d / 2 + 0.26, 0.55, top - 0.02, seed);
  if (hash3(seed, 5, 5) < 0.35) {
    for (const s of [-1, 1]) {
      p.part(new THREE.CylinderGeometry(0.04, 0.05, h * 0.8, 6), T.postWood, [s * (w * 0.42), 0.22 + h * 0.4, frontZ + 0.55], undefined, undefined, { castShadow: true });
    }
    p.part(new THREE.BoxGeometry(w * 0.98, 0.06, 0.9), T.thatchDark, [0, 0.22 + h * 0.8, frontZ + 0.36], [0.14, 0, 0], undefined, THATCH_SPEC);
  }
}

/** Chief's compound: a larger hall with a raised veranda on posts under a lower sloped slab, plus a deeper roof. */
function buildChief(c: HutCtx): void {
  const { p, seed, wall, w, d, h } = c;
  const T = VILLAGE_PALETTE;
  const base = 0.26;
  const lean = (hash3(seed, 8, 3) - 0.5) * 0.05;
  p.part(new THREE.BoxGeometry(w * 1.03, base, d * 1.03), T.wallStone, [0, base / 2, 0], undefined, undefined, { roughness: 1, receiveShadow: true });
  p.part(mudWall(w, h, d, 0.04, lean, seed, dampFor(seed)), wallTone(wall, seed), [0, base + h / 2, 0], undefined, undefined, SHELL);
  const top = base + h;
  p.part(new THREE.BoxGeometry(w + 0.06, 0.07, d + 0.06), T.wallLight, [0, top - 0.02, 0], undefined, undefined, { roughness: 0.95, castShadow: true });
  const frontZ = (d / 2) * 1.03;
  doorway(c, frontZ, base, h * 0.7, 0);
  // veranda: raised floor, posts, sloped slab
  const vd = 0.95;
  const vz = d / 2 + vd / 2;
  p.part(new THREE.BoxGeometry(w + 0.5, 0.12, vd), T.postWood, [0, base - 0.04, vz], undefined, undefined, { roughness: 0.95, receiveShadow: true });
  const postH = h * 0.92;
  for (let i = 0; i < 5; i++) {
    const x = -(w / 2 + 0.2) + (i * (w + 0.4)) / 4;
    p.part(new THREE.CylinderGeometry(0.05, 0.06, postH, 6), T.postWood, [x, base + postH / 2, d / 2 + vd - 0.05], undefined, undefined, { castShadow: true });
  }
  p.part(new THREE.BoxGeometry(w + 0.5, 0.07, vd + 0.35), T.thatchDark, [0, base + postH + 0.02, d / 2 + vd / 2 + 0.1], [0.3, 0, 0], undefined, THATCH_SPEC);
  hipRoofThick(p, w / 2 + 0.32, d / 2 + 0.32, 0.72, top - 0.02, seed);
}

/** Granary on stilts: raised plank platform, round woven body with a bulge, and a thatch cap with overhang. */
function buildGranary(c: HutCtx): void {
  const { p, seed, wall, w, d } = c;
  const T = VILLAGE_PALETTE;
  const legH = 0.55;
  const bodyH = 0.6;
  const R = Math.min(w, d) * 0.4;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const lx = sx * (w / 2 - 0.1);
      const lz = sz * (d / 2 - 0.1);
      p.part(new THREE.CylinderGeometry(0.075, 0.06, legH + 0.04, 8), T.postWood, [lx, legH / 2, lz], [0, 0, sx * 0.05], undefined, { castShadow: true });
      p.part(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 8), T.rockBase, [lx, 0.025, lz], undefined, undefined, { roughness: 1, castShadow: true });
    }
  }
  const platY = legH + 0.035;
  p.part(new THREE.BoxGeometry(w + 0.08, 0.07, d + 0.08), T.postWood, [0, platY, 0], undefined, undefined, { roughness: 0.9, castShadow: true, receiveShadow: true });
  p.part(roundWall(R, bodyH, 12, 0.14, seed, dampFor(seed)), wallTone(wall, seed), [0, legH + 0.07 + bodyH / 2, 0], undefined, undefined, SHELL);
  const capBase = legH + 0.07 + bodyH - 0.03;
  const capH = 0.5;
  p.part(thatchCone(R + 0.34, 0.08, capH, seed), T.thatch, [0, capBase + capH / 2, 0], undefined, undefined, THATCH_SPEC);
  p.part(thatchCone(R + 0.22, 0.1, capH * 0.5, seed + 3), T.thatchDark, [0, capBase + capH * 0.25, 0], undefined, undefined, THATCH_SPEC);
  p.part(new THREE.TorusGeometry(R + 0.34, 0.055, 4, 14), T.thatchDark, [0, capBase + 0.03, 0], [Math.PI / 2, 0, 0], undefined, THATCH_SPEC);
  p.part(new THREE.SphereGeometry(0.09, 6, 5), T.thatchDark, [0, capBase + capH + 0.02, 0], undefined, [1, 0.7, 1], THATCH_SPEC);
  // ladder leaning on the platform
  const L = 0.82;
  p.part(new THREE.BoxGeometry(0.05, L, 0.05), T.timberDark, [0, legH / 2, d / 2 + 0.3], [-0.74, 0, 0], undefined, { castShadow: true });
}

/** Smith's workshop: open-fronted shed, back mud wall, clay forge with chimney, anvil on a stump, charcoal heap. */
function buildSmith(c: HutCtx): void {
  const { p, seed, wall, w, d, h } = c;
  const T = VILLAGE_PALETTE;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      p.part(new THREE.CylinderGeometry(0.05, 0.06, h, 6), T.postWood, [sx * (w / 2 - 0.05), h / 2, sz * (d / 2 - 0.05)], undefined, undefined, { castShadow: true });
    }
  }
  p.part(mudWall(w - 0.1, h * 0.5, 0.16, 0.04, (hash3(seed, 9, 3) - 0.5) * 0.04, seed, dampFor(seed)), wallTone(wall, seed), [0, (h * 0.5) / 2, -d / 2 + 0.06], undefined, undefined, SHELL);
  hipRoofThick(p, w / 2 + 0.2, d / 2 + 0.2, 0.6, h - 0.02, seed);
  // forge: clay dome and chimney pipe
  p.part(new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), T.wallClay, [w * 0.22, 0.02, -d * 0.12], undefined, [1, 0.9, 1], SHELL);
  p.part(new THREE.CylinderGeometry(0.06, 0.09, 0.42, 7), T.wallClay, [w * 0.22, 0.52, -d * 0.12], undefined, undefined, { roughness: 0.98, castShadow: true });
  // anvil on a stump
  p.part(new THREE.CylinderGeometry(0.1, 0.12, 0.25, 7), T.timberDark, [-w * 0.25, 0.125, d * 0.1], undefined, undefined, { castShadow: true });
  p.part(new THREE.BoxGeometry(0.24, 0.1, 0.12), T.roofSteel, [-w * 0.25, 0.3, d * 0.1], undefined, undefined, { roughness: 0.5, metalness: 0.4, castShadow: true });
  // charcoal heap
  for (let i = 0; i < 4; i++) {
    p.part(new THREE.SphereGeometry(0.05, 5, 4), T.windowDark, [-w * 0.05 + (i % 2) * 0.1, 0.04, -d * 0.25 + (i >> 1) * 0.08]);
  }
}

/** Meeting pavilion: eight open posts under a broad thatch cone, a ring of log benches and a firepit. */
function buildPavilion(c: HutCtx): void {
  const { p, seed, w, h } = c;
  const T = VILLAGE_PALETTE;
  const R = w / 2 * 0.7;
  const ph = h;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.part(new THREE.CylinderGeometry(0.07, 0.085, ph, 7), T.postWood, [Math.cos(a) * R, ph / 2, Math.sin(a) * R], [0, 0, Math.cos(a) * 0.025], undefined, { castShadow: true });
  }
  const rBot = R + 0.5;
  const H = 0.95;
  const base = ph - 0.04;
  p.part(thatchCone(rBot, 0.12, H, seed), T.thatch, [0, base + H / 2, 0], undefined, undefined, THATCH_SPEC);
  p.part(new THREE.TorusGeometry(rBot, 0.05, 4, 16), T.thatchDark, [0, base + 0.03, 0], [Math.PI / 2, 0, 0], undefined, THATCH_SPEC);
  p.part(new THREE.SphereGeometry(0.11, 6, 5), T.thatchDark, [0, base + H + 0.02, 0], undefined, [1, 0.7, 1], THATCH_SPEC);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    p.part(new THREE.BoxGeometry(0.5, 0.08, 0.16), T.postWood, [Math.cos(a) * (R * 0.7), 0.22, Math.sin(a) * (R * 0.7)], [0, -a, 0], undefined, { castShadow: true });
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    p.part(new THREE.DodecahedronGeometry(0.07, 0), T.rockBase, [Math.cos(a) * 0.35, 0.04, Math.sin(a) * 0.35], undefined, undefined, { castShadow: true });
  }
}

/** Clay pot and a stacked firewood pile, placed in hut-local coordinates. */
function clayPot(p: Placer, x: number, z: number, s: number): void {
  p.part(new THREE.SphereGeometry(0.13, 7, 5), VILLAGE_PALETTE.clayPot, [x, 0.13 * s, z], undefined, [s, s * 0.85, s], { roughness: 0.85, castShadow: true });
}

function firewoodStack(p: Placer, x: number, z: number): void {
  for (let row = 0; row < 3; row++) {
    const n = 4 - row;
    for (let i = 0; i < n; i++) {
      p.part(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 5), VILLAGE_PALETTE.woodDark, [x + (i - (n - 1) / 2) * 0.11, 0.05 + row * 0.09, z], [0, 0, Math.PI / 2], undefined, { castShadow: true });
    }
  }
}

export type HutKind = "family" | "round" | "chief" | "granary" | "smith" | "pavilion";

/** Default footprint per archetype when a spec leaves w/d/h out. */
function kindDefaults(kind: HutKind): { w: number; d: number; h: number } {
  switch (kind) {
    case "round": return { w: 1.25, d: 1.25, h: 1.0 };
    case "chief": return { w: 2.1, d: 1.5, h: 1.25 };
    case "granary": return { w: 0.95, d: 0.95, h: 0.6 };
    case "smith": return { w: 1.6, d: 1.2, h: 1.0 };
    case "pavilion": return { w: 2.0, d: 2.0, h: 1.55 };
    default: return { w: 1.2, d: 1.05, h: 0.95 };
  }
}

export function addHut(batch: PropBatch, spec: HutSpec): void {
  const kind: HutKind = spec.kind ?? (spec.style === "round" ? "round" : "family");
  const def = kindDefaults(kind);
  const jitter = 0.96 + hash3(spec.x, spec.z, 9) * 0.08;
  const w = (spec.w ?? def.w) * jitter;
  const d = (spec.d ?? def.d) * jitter;
  const h = (spec.h ?? def.h) * (0.97 + hash3(spec.x, spec.z, 12) * 0.06);
  const rot = (spec.rot ?? 0) + (hash3(spec.x, spec.z, 10) - 0.5) * 0.3;
  const T = VILLAGE_PALETTE;
  const p = new Placer(batch, groupMatrix([spec.x, 0, spec.z], rot));
  const seed = Math.floor(hash3(spec.x, spec.z, 11) * 1000);
  const c: HutCtx = { p, wall: spec.wall ?? T.wallOchre, seed, w, d, h };

  // packed earth pad under every archetype
  p.part(new THREE.CircleGeometry(Math.max(w, d) * 0.8, 12), T.groundDirt, [0, 0.01, 0], [-Math.PI / 2, 0, 0], undefined, { receiveShadow: true });

  switch (kind) {
    case "round": buildRound(c); break;
    case "chief": buildChief(c); break;
    case "granary": buildGranary(c); break;
    case "smith": buildSmith(c); break;
    case "pavilion": buildPavilion(c); break;
    default: buildFamily(c); break;
  }

  // dressing: a firewood pile and a couple of pots at the side of the compound
  if (kind !== "pavilion") {
    const side = hash3(spec.x, spec.z, 13) < 0.5 ? -1 : 1;
    firewoodStack(p, side * (w / 2 + 0.38), -d * 0.18);
    clayPot(p, side * (w / 2 + 0.2), d * 0.3, 1);
    clayPot(p, side * (w / 2 + 0.18), d * 0.3 + 0.32, 0.8);
  }
}

export function addTree(batch: PropBatch, x: number, z: number, s: number, kind: TreeKind): void {
  const p = new Placer(batch, groupMatrix([x, 0, z], 0, [s, s, s]));
  if (kind === "palm") {
    p.part(new THREE.CylinderGeometry(0.07, 0.11, 2.2, 6), VILLAGE_PALETTE.woodDark, [0, 1.1, 0], undefined, undefined, { castShadow: true });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      p.part(
        new THREE.BoxGeometry(0.12, 0.04, 0.9),
        VILLAGE_PALETTE.grassGreen,
        [Math.cos(a) * 0.35, 2.15, Math.sin(a) * 0.35],
        [0.6, a, 0],
        undefined,
        { roughness: 0.9, castShadow: true },
      );
    }
    return;
  }
  const broad = kind === "broad";
  const trunkH = broad ? 1.8 : 1.45;
  // Trunk tapers and forks into two limbs so the canopy has something to sit on.
  p.part(new THREE.CylinderGeometry(0.08, 0.15, trunkH, 7), VILLAGE_PALETTE.trunk, [0, trunkH / 2, 0], undefined, undefined, { castShadow: true });
  const limbLen = broad ? 0.9 : 0.7;
  for (const sign of [-1, 1]) {
    p.part(new THREE.CylinderGeometry(0.05, 0.08, limbLen, 5), VILLAGE_PALETTE.trunk, [sign * 0.18, trunkH + 0.25, 0.04], [0, 0, sign * 0.5], undefined, { castShadow: true });
  }
  // Layered canopy: a dark base mass, mid clusters pushed outward and up, and light crowns on top.
  // Each cluster is a low-poly sphere squashed flat so the crown reads as foliage, not a cone.
  const crownR = broad ? 0.95 : 0.7;
  const clusters: Array<[number, number, number, number, keyof typeof VILLAGE_PALETTE]> = [
    [0, trunkH + 0.1, 0, crownR, "treeDark"],
    [crownR * 0.62, trunkH + 0.3, crownR * 0.35, crownR * 0.6, "treeMid"],
    [-crownR * 0.6, trunkH + 0.25, -crownR * 0.3, crownR * 0.58, "treeMid"],
    [crownR * 0.1, trunkH + 0.55, -crownR * 0.45, crownR * 0.5, "leafMid2"],
    [-crownR * 0.25, trunkH + 0.62, crownR * 0.42, crownR * 0.46, "treeLight"],
  ];
  for (const [cx, cy, cz, r, key] of clusters) {
    p.part(new THREE.IcosahedronGeometry(r, 1), VILLAGE_PALETTE[key], [cx, cy, cz], [0.1, 0.25, 0.05], [1, 0.72, 1], {
      roughness: 0.9,
      castShadow: true,
    });
  }
}

/** Always-loaded dressing for the whole village, merged once. */
export function buildStaticVillageProps(): MergedPropMesh[] {
  const batch = new PropBatch();
  for (const [x, z, sc] of roadsideBushes()) addBush(batch, x, z, sc);
  for (const [x, z] of GRAIN_STACKS) addGrain(batch, x, z);
  for (const [x, z, s] of CLAY_POTS) addPot(batch, x, z, s);

  // fence along the south edge of the market
  const fence = new Placer(batch);
  for (let i = 0; i < 8; i++) {
    fence.part(new THREE.BoxGeometry(0.05, 0.76, 0.05), VILLAGE_PALETTE.woodDark, [-3.2 + i * 0.35, 0.38, 5.15], undefined, undefined, {
      castShadow: true,
    });
  }
  fence.part(new THREE.BoxGeometry(2.6, 0.04, 0.04), VILLAGE_PALETTE.fenceWood, [-1.95, 0.55, 5.15], undefined, undefined, { roughness: 1 });

  // market mats: a top slab on four legs each
  for (const [mx, mz] of MARKET_MATS) {
    const m = new Placer(batch, groupMatrix([mx, 0, mz]));
    m.part(new THREE.BoxGeometry(0.95, 0.05, 0.48), VILLAGE_PALETTE.matWeave, [0, 0.48, 0], undefined, undefined, {
      roughness: 0.9,
      castShadow: true,
    });
    for (const [lx, lz] of MARKET_MAT_LEGS) {
      m.part(new THREE.BoxGeometry(0.05, 0.48, 0.05), VILLAGE_PALETTE.postWood, [lx, 0.24, lz]);
    }
  }

  // grass pads
  const pads = new Placer(batch);
  GRASS_PAD_POINTS.forEach(([gx, gz], i) => {
    pads.part(
      new THREE.CircleGeometry(1.0 + (i % 3) * 0.25, 10),
      i % 2 ? VILLAGE_PALETTE.grassLight : VILLAGE_PALETTE.grassDark,
      [gx, 0.02, gz],
      [-Math.PI / 2, 0, 0],
    );
  });

  return batch.build();
}

/** Huts, trees, compound walls and rocks that fall inside one streamed chunk, merged. */
export function buildChunkVillageProps(chunk: ChunkCoord): MergedPropMesh[] {
  const batch = new PropBatch();
  const inChunk = (x: number, z: number) => {
    const c = chunkOf(x, z);
    return c.cx === chunk.cx && c.cz === chunk.cz;
  };
  for (const h of VILLAGE_HUTS) if (inChunk(h.x, h.z)) addHut(batch, h);
  for (const [x, z, s, kind] of VILLAGE_TREES) if (inChunk(x, z)) addTree(batch, x, z, s, kind);
  for (const [x, z, r, n, gate] of VILLAGE_WALLS) if (inChunk(x, z)) addCompoundWall(batch, x, z, r, n, gate);
  for (const [x, z, s] of VILLAGE_ROCKS) if (inChunk(x, z)) addRock(batch, x, z, s);
  return batch.build();
}
