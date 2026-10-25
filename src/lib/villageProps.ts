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
  style?: "thatch" | "zinc" | "round";
  wall?: string;
  w?: number;
  d?: number;
  h?: number;
}

export type TreeKind = "acacia" | "broad" | "palm";

export const VILLAGE_HUTS: HutSpec[] = [
  // Market compound (around the market square, MARKET_SQUARE)
  { x: -4.4, z: 3.8, style: "thatch", wall: VILLAGE_PALETTE.wallSand, w: 1.25, d: 1.1 },
  { x: -3.0, z: 4.4, style: "zinc", wall: VILLAGE_PALETTE.wallWarm, w: 1.35, d: 1.15, h: 1.05 },
  { x: -5.2, z: 2.6, style: "thatch", wall: VILLAGE_PALETTE.wallClay, rot: 0.35, w: 1.2 },
  { x: -3.5, z: 2.0, style: "round", wall: VILLAGE_PALETTE.wallTan, w: 1.35, h: 1.0 },
  { x: -2.0, z: 3.2, style: "zinc", wall: VILLAGE_PALETTE.wallDusk, rot: -0.25 },
  { x: -4.8, z: 4.6, style: "round", wall: VILLAGE_PALETTE.wallOchre, w: 1.1, h: 0.9 },
  { x: -5.5, z: 3.5, style: "thatch", wall: VILLAGE_PALETTE.wallSand, rot: 0.6, w: 1.05 },
  // Chief's compound (CHIEF_COMPOUND, gate faces the main road)
  { x: 2.8, z: -10.6, style: "thatch", wall: VILLAGE_PALETTE.wallOchre, w: 1.3, d: 1.15 },
  { x: 5.6, z: -11.4, style: "round", wall: VILLAGE_PALETTE.wallPale, w: 1.3, h: 1.05 },
  { x: 5.9, z: -8.6, style: "zinc", wall: VILLAGE_PALETTE.wallGrey, w: 1.2 },
  // Waterside / creekside (north-west shore of the pond)
  { x: -11.3, z: -5.4, style: "round", wall: VILLAGE_PALETTE.wallOchre, w: 1.4, h: 1.05 },
  { x: -10.5, z: -8.4, style: "thatch", wall: VILLAGE_PALETTE.wallClay, rot: -0.2, w: 1.25 },
  { x: -11.8, z: -3.6, style: "zinc", wall: VILLAGE_PALETTE.wallDusk, w: 1.2 },
  { x: -8.4, z: -10.8, style: "round", wall: VILLAGE_PALETTE.wallSand, w: 1.15, h: 1.0 },
  { x: -5.2, z: -11.4, style: "thatch", wall: VILLAGE_PALETTE.wallClay, w: 1.1 },
  { x: -2.2, z: -10.6, style: "zinc", wall: VILLAGE_PALETTE.wallGrey, rot: 0.3, w: 1.2 },
  // Port edge (PORT compound, south of the main road)
  { x: 10.4, z: 5.6, style: "zinc", wall: VILLAGE_PALETTE.wallStone, w: 1.55, d: 1.25, h: 1.1 },
  { x: 11.8, z: 4.5, style: "thatch", wall: VILLAGE_PALETTE.wallOchre, w: 1.2 },
  { x: 9.7, z: 3.7, style: "zinc", wall: VILLAGE_PALETTE.wallGrey, rot: 0.3, w: 1.3 },
  { x: 12.4, z: 5.9, style: "round", wall: VILLAGE_PALETTE.wallWarm, w: 1.2 },
  { x: 11.0, z: 6.5, style: "thatch", wall: VILLAGE_PALETTE.wallClay, rot: 0.15 },
  { x: 13.0, z: 4.8, style: "zinc", wall: VILLAGE_PALETTE.wallStone, w: 1.15 },
  // Farm outskirts (FARM, south-east)
  { x: 13.0, z: 12.6, style: "thatch", wall: VILLAGE_PALETTE.wallClay, rot: 0.4, w: 1.15 },
  { x: 19.0, z: 13.2, style: "zinc", wall: VILLAGE_PALETTE.wallStone, rot: -0.3, w: 1.1 },
  // Path-side, set back from the main road
  { x: -8.0, z: 8.0, style: "zinc", wall: VILLAGE_PALETTE.wallWarm, w: 1.35, d: 1.15, h: 1.05 },
  { x: -11.0, z: 3.0, style: "thatch", wall: VILLAGE_PALETTE.wallClay, rot: 0.35, w: 1.2 },
  { x: -4.0, z: 10.5, style: "round", wall: VILLAGE_PALETTE.wallTan, w: 1.35, h: 1.0 },
  { x: 2.6, z: 8.0, style: "zinc", wall: VILLAGE_PALETTE.wallDusk, rot: -0.25 },
];

/** Hut footprint radius for collision (circle approximation of the walls). */
export function hutRadius(h: HutSpec): number {
  const { w = 1.15, d = 1.05, style = "thatch" } = h;
  if (style === "round") return w * 0.6;
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

/** Deterministic 0..1 value per hut from its position, so every player sees the same village. */
function hash01(x: number, z: number, salt: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
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

function triGeometry(verts: V3[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts.flat(), 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Hipped thatch roof: four sloped faces meeting at a short ridge along x.
 * Eave base is at y=0 (the caller places it on the walls), apex at y=height.
 */
function hipRoof(hw: number, hd: number, height: number): { faces: THREE.BufferGeometry; ends: THREE.BufferGeometry } {
  const ridge = Math.max(0, hw - hd) * 0.6;
  const FL: V3 = [-hw, 0, hd];
  const FR: V3 = [hw, 0, hd];
  const BR: V3 = [hw, 0, -hd];
  const BL: V3 = [-hw, 0, -hd];
  const R1: V3 = [-ridge, height, 0];
  const R2: V3 = [ridge, height, 0];
  return {
    faces: triGeometry([...doubleQuad(FL, FR, R2, R1), ...doubleQuad(BR, BL, R1, R2)]),
    ends: triGeometry([...doubleTri(FR, BR, R2), ...doubleTri(BL, FL, R1)]),
  };
}

/** Gable roof with the ridge along z: two slopes, plus the two end triangles (wall-coloured). */
function gableRoof(hw: number, hd: number, height: number): { slopes: THREE.BufferGeometry; ends: THREE.BufferGeometry } {
  // eaves at x=±hw, z=±hd (y=0); ridge along z at x=0 (y=height)
  const LF: V3 = [-hw, 0, hd];
  const LB: V3 = [-hw, 0, -hd];
  const RF: V3 = [hw, 0, hd];
  const RB: V3 = [hw, 0, -hd];
  const PF: V3 = [0, height, hd];
  const PB: V3 = [0, height, -hd];
  return {
    slopes: triGeometry([...doubleQuad(LF, PF, PB, LB), ...doubleQuad(PF, RF, RB, PB)]),
    ends: triGeometry([...doubleTri(LF, RF, PF), ...doubleTri(LB, RB, PB)]),
  };
}

export function addHut(batch: PropBatch, spec: HutSpec): void {
  const { x, z, rot = 0, w = 1.15, d = 1.05, h = 0.95, style = "thatch", wall = VILLAGE_PALETTE.wallOchre } = spec;
  const T = VILLAGE_PALETTE;
  const p = new Placer(batch, groupMatrix([x, 0, z], rot));
  const isRound = style === "round";
  const isZinc = style === "zinc";

  // Per-hut variation from position: door width and offset, window and porch, wall tone.
  const rDoor = hash01(x, z, 1);
  const rDoorX = hash01(x, z, 2);
  const rWin = hash01(x, z, 3);
  const rTone = hash01(x, z, 4);
  const wallCol = `#${new THREE.Color(wall).lerp(new THREE.Color(T.wallPale), rTone * 0.22).getHexString()}`;
  const shell = { roughness: 0.98, castShadow: true, receiveShadow: true };

  const R = isRound ? w * 0.55 : 0; // round wall radius at the base
  const frontZ = isRound ? R * 0.96 : d / 2;

  // packed earth pad
  p.part(new THREE.CircleGeometry(Math.max(w, d) * 0.8, 14), T.groundDirt, [0, 0.01, 0], [-Math.PI / 2, 0, 0], undefined, {
    receiveShadow: true,
  });

  // stone plinth: the walls rest on it, so the hut reads as built, not stuck on the ground
  p.part(
    isRound ? new THREE.CylinderGeometry(R * 1.08, R * 1.12, 0.26, 14) : new THREE.BoxGeometry(w * 1.04, 0.26, d * 1.04),
    T.wallStone,
    [0, 0.13, 0],
    undefined,
    undefined,
    { roughness: 1, receiveShadow: true },
  );

  // walls: round walls batter slightly inwards at the top
  p.part(
    isRound ? new THREE.CylinderGeometry(R * 0.93, R, h, 14) : new THREE.BoxGeometry(w, h, d),
    wallCol,
    [0, h / 2, 0],
    undefined,
    undefined,
    shell,
  );

  // timber corner posts, proud of the wall, so the walls read as a frame
  const postCount = isRound ? 6 : 4;
  for (let i = 0; i < postCount; i++) {
    const a = (i / postCount) * Math.PI * 2 + Math.PI / postCount;
    const px = isRound ? Math.cos(a) * R * 0.97 : (i % 2 ? 1 : -1) * (w / 2 + 0.01);
    const pz = isRound ? Math.sin(a) * R * 0.97 : (i < 2 ? 1 : -1) * (d / 2 + 0.01);
    p.part(new THREE.BoxGeometry(0.08, h + 0.04, 0.08), T.timberDark, [px, (h + 0.04) / 2, pz], undefined, undefined, {
      castShadow: true,
    });
  }

  // door: planked panel with batten bars, side posts and a lintel. Width and offset vary per hut.
  const doorW = 0.3 + rDoor * 0.12;
  const doorH = h * (0.6 + rDoorX * 0.08);
  const doorX = isRound ? 0 : (rDoorX - 0.5) * w * 0.24;
  p.part(new THREE.BoxGeometry(doorW, doorH, 0.03), T.doorWood, [doorX, doorH / 2, frontZ + 0.012]);
  for (const f of [0.35, 0.72]) {
    p.part(new THREE.BoxGeometry(doorW * 0.9, 0.04, 0.035), T.timberDark, [doorX, doorH * f, frontZ + 0.024]);
  }
  for (const s of [-1, 1]) {
    p.part(new THREE.BoxGeometry(0.06, doorH + 0.06, 0.07), T.timberDark, [doorX + s * (doorW / 2 + 0.03), (doorH + 0.06) / 2, frontZ + 0.02]);
  }
  p.part(new THREE.BoxGeometry(doorW + 0.16, 0.07, 0.08), T.timberDark, [doorX, doorH + 0.05, frontZ + 0.02]);

  // shuttered window on the back wall (rectangular huts only, about half of them)
  if (!isRound && rWin > 0.45) {
    const wx = (rWin - 0.5) * w * 0.4;
    p.part(new THREE.BoxGeometry(0.2, 0.18, 0.03), T.windowDark, [wx, h * 0.62, -d / 2 - 0.012]);
    for (const s of [-1, 1]) {
      p.part(new THREE.BoxGeometry(0.07, 0.22, 0.04), T.timberDark, [wx + s * 0.135, h * 0.62, -d / 2 - 0.02]);
    }
    p.part(new THREE.BoxGeometry(0.26, 0.04, 0.06), T.timberDark, [wx, h * 0.62 - 0.11, -d / 2 - 0.02]);
  }

  // porch shade on about a third of rectangular huts: two posts and a slanted thatch slab over the door
  if (!isRound && rWin < 0.33) {
    for (const s of [-1, 1]) {
      p.part(new THREE.BoxGeometry(0.07, h * 0.8, 0.07), T.postWood, [s * (w * 0.42), h * 0.4, d / 2 + 0.55], undefined, undefined, {
        castShadow: true,
      });
    }
    p.part(new THREE.BoxGeometry(w * 0.98, 0.06, 0.9), T.thatchDark, [0, h * 0.8, d / 2 + 0.36], [-0.14, 0, 0], undefined, {
      roughness: 0.98,
      castShadow: true,
    });
  }

  // roof
  if (isRound) {
    const rr = R + 0.22;
    p.part(new THREE.CylinderGeometry(rr * 0.5, rr, 0.32, 16), T.thatch, [0, h + 0.14, 0], undefined, undefined, {
      roughness: 0.95,
      castShadow: true,
    });
    p.part(new THREE.ConeGeometry(rr * 0.6, 0.6, 16), T.thatchDark, [0, h + 0.6, 0], undefined, undefined, {
      roughness: 0.95,
      castShadow: true,
    });
    p.part(new THREE.SphereGeometry(0.08, 8, 6), T.timberDark, [0, h + 0.92, 0]);
  } else if (isZinc) {
    const hw = w / 2 + 0.14;
    const hd = d / 2 + 0.14;
    const H = 0.5;
    const g = gableRoof(hw, hd, H);
    p.part(g.slopes, T.zincRoof, [0, h, 0], undefined, undefined, { roughness: 0.5, metalness: 0.4, castShadow: true });
    p.part(g.ends, wallCol, [0, h, 0], undefined, undefined, { roughness: 0.98, castShadow: true });
    p.part(new THREE.BoxGeometry(0.06, 0.06, hd * 2 + 0.06), T.roofSteel, [0, h + H, 0], undefined, undefined, {
      roughness: 0.45,
      metalness: 0.5,
    });
  } else {
    const hw = w / 2 + 0.14;
    const hd = d / 2 + 0.14;
    const H = 0.62;
    const r = hipRoof(hw, hd, H);
    p.part(r.faces, T.thatch, [0, h, 0], undefined, undefined, { roughness: 0.98, castShadow: true });
    p.part(r.ends, T.thatchDark, [0, h, 0], undefined, undefined, { roughness: 0.98, castShadow: true });
    p.part(new THREE.BoxGeometry(0.1, 0.08, 0.1), T.beamWood, [0, h + H, 0]);
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
  const trunkH = kind === "broad" ? 1.8 : 1.45;
  p.part(new THREE.CylinderGeometry(0.09, 0.14, trunkH, 7), VILLAGE_PALETTE.trunk, [0, trunkH / 2, 0], undefined, undefined, { castShadow: true });
  p.part(new THREE.SphereGeometry(kind === "broad" ? 0.85 : 0.6, 9, 9), VILLAGE_PALETTE.treeMid, [0, trunkH + 0.15, 0], undefined, undefined, {
    roughness: 0.88,
    castShadow: true,
  });
  p.part(new THREE.SphereGeometry(0.45, 8, 8), VILLAGE_PALETTE.leafMid2, [0.35, trunkH + 0.35, 0.15], undefined, undefined, {
    roughness: 0.9,
    castShadow: true,
  });
  p.part(new THREE.SphereGeometry(0.4, 8, 8), VILLAGE_PALETTE.treeDark, [-0.3, trunkH + 0.25, -0.2], undefined, undefined, {
    roughness: 0.92,
    castShadow: true,
  });
  if (kind === "broad") {
    p.part(new THREE.SphereGeometry(0.5, 8, 8), VILLAGE_PALETTE.treeLight, [0.1, trunkH + 0.55, -0.25], undefined, undefined, {
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
