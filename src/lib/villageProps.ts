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

/**
 * All rondavel / bhunga style — matches reference photos:
 * stone plinth, ochre mud, white lime band, veranda posts, conical thatch.
 * Layout follows the site plan compounds with open yards.
 */
export const VILLAGE_HUTS: HutSpec[] = [
  // ——— Yoruba-style compound (NW, ~ -8, 4) — ring with open centre ———
  { x: -10.5, z: 6.5, style: "round", wall: VILLAGE_PALETTE.wallOchre, w: 2.9, rot: 0.4 },
  { x: -6.0, z: 9.0, style: "round", wall: VILLAGE_PALETTE.wallSand, w: 2.8, rot: -0.8 },
  { x: -12.5, z: 2.0, style: "round", wall: VILLAGE_PALETTE.wallClay, w: 2.7, rot: 1.2 },
  { x: -5.5, z: 2.5, style: "round", wall: VILLAGE_PALETTE.wallWarm, w: 2.75, rot: -1.5 },

  // ——— Igbo-style craft compound (E, ~ 7, 5) ———
  { x: 8.5, z: 7.5, style: "round", wall: VILLAGE_PALETTE.wallOchre, w: 2.85, rot: 0.2 },
  { x: 12.5, z: 5.0, style: "round", wall: VILLAGE_PALETTE.wallTan, w: 2.7, rot: -0.9 },
  { x: 10.0, z: 2.0, style: "round", wall: VILLAGE_PALETTE.wallClay, w: 2.8, rot: 1.1 },
  { x: 5.5, z: 4.5, style: "round", wall: VILLAGE_PALETTE.wallSand, w: 2.65, rot: -0.3 },

  // ——— Creekside dwellings (SW near pond) ———
  { x: -12.0, z: -8.5, style: "round", wall: VILLAGE_PALETTE.wallOchre, w: 2.8, rot: 0.6 },
  { x: -16.0, z: -5.0, style: "round", wall: VILLAGE_PALETTE.wallClay, w: 2.7, rot: -1.0 },
  { x: -8.5, z: -11.5, style: "round", wall: VILLAGE_PALETTE.wallWarm, w: 2.75, rot: 0.15 },

  // ——— Town market quarter (~18, 20) — sparse ———
  { x: 16.5, z: 22.0, style: "round", wall: VILLAGE_PALETTE.wallOchre, w: 2.7, rot: 0.5 },
  { x: 21.5, z: 18.5, style: "round", wall: VILLAGE_PALETTE.wallSand, w: 2.65, rot: -0.7 },
  { x: 20.0, z: 24.0, style: "round", wall: VILLAGE_PALETTE.wallTan, w: 2.7, rot: 1.3 },

  // ——— Southern fringe ———
  { x: 2.0, z: -11.0, style: "round", wall: VILLAGE_PALETTE.wallClay, w: 2.8, rot: 0.35 },
  { x: 8.0, z: -9.0, style: "round", wall: VILLAGE_PALETTE.wallOchre, w: 2.7, rot: -1.2 },
];

export const VILLAGE_TREES: Array<[number, number, number, TreeKind]> = [
  [-6.5, 4.5, 1.15, "broad"],
  [-1.5, 5.5, 1.0, "acacia"],
  [2.8, 5.2, 1.25, "broad"],
  [8.2, 1.2, 1.05, "acacia"],
  [7.8, -2.2, 1.2, "broad"],
  [3.5, -4.8, 0.95, "acacia"],
  [-3.8, -5.2, 1.1, "broad"],
  [-8.8, -3.2, 1.3, "broad"],
  [-8.5, 0.8, 0.9, "acacia"],
  [0.8, 0.2, 0.75, "acacia"],
  [4.2, 2.2, 0.85, "palm"],
  [-2.8, 0.4, 0.8, "acacia"],
  [8.8, 4.2, 1.15, "broad"],
  [-0.2, -5.5, 1.05, "broad"],
  [-9.2, -5.0, 1.2, "palm"],
  [9.0, -0.5, 1.0, "palm"],
  [-5.0, 6.0, 1.1, "broad"],
  [5.5, -3.5, 0.95, "acacia"],
  [-10, -1.0, 1.15, "broad"],
  [1.5, 6.2, 1.0, "acacia"],
];

/** Compound rings aligned to Yoruba / Igbo / creekside / market clusters. */
export const VILLAGE_WALLS: Array<[number, number, number, number]> = [
  [-8.5, 5.0, 9.0, 18],   // Yoruba compound
  [9.0, 5.0, 8.5, 16],    // Igbo compound
  [-12.0, -8.0, 8.0, 16], // creekside
  [19.0, 21.5, 8.0, 16],  // town market
];

/** Rocks: x, z, scale. */
export const VILLAGE_ROCKS: Array<[number, number, number]> = [
  [-4.2, -5.8, 1.2],
  [-3.5, -6.2, 0.8],
  [-7.5, -5.5, 1.4],
  [8.5, -3.0, 1.1],
  [-9.0, 2.0, 0.9],
  [2.0, 6.0, 0.7],
  [9.2, 5.0, 1.0],
];

const GRAIN_STACKS: Array<[number, number]> = [
  [-3.2, 2.8],
  [-4.6, 3.2],
  [-6.0, -3.6],
  [1.0, -2.2],
  [5.8, 2.0],
  [-7.2, -2.2],
];

/** Clay pots: x, z, scale. */
const CLAY_POTS: Array<[number, number, number]> = [
  [-4.0, 3.5, 1],
  [-4.15, 3.35, 0.8],
  [-1.0, -2.3, 1],
  [-6.4, -2.5, 1.15],
  [5.0, 3.2, 1],
  [0.4, -3.4, 0.9],
  [-3.2, 1.9, 0.85],
  [6.5, 2.2, 1],
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

export function addCompoundWall(batch: PropBatch, x: number, z: number, radius: number, segments: number): void {
  const p = new Placer(batch);
  const posts = Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    return [x + Math.cos(a) * radius, z + Math.sin(a) * radius] as const;
  });
  posts.forEach(([px, pz], i) => {
    const [qx, qz] = posts[(i + 1) % posts.length]!;
    const len = Math.hypot(qx - px, qz - pz);
    const ang = Math.atan2(qx - px, qz - pz);
    p.part(
      new THREE.BoxGeometry(0.22, 1.45, len * 0.95),
      VILLAGE_PALETTE.wallSand,
      [(px + qx) / 2, 0.72, (pz + qz) / 2],
      [0, ang, 0],
      undefined,
      { roughness: 0.98, castShadow: true, receiveShadow: true },
    );
  });
}

/**
 * Traditional rondavel / bhunga — matches reference:
 * raised stone plinth, ochre mud walls, broad white lime band,
 * recessed timber door, veranda posts, deep conical thatch.
 * (Zinc roofs removed — pre-colonial look only.)
 */
export function addHut(batch: PropBatch, spec: HutSpec): void {
  const { x, z, rot = 0, w = 2.7, wall = VILLAGE_PALETTE.wallOchre } = spec;
  const p = new Placer(batch, groupMatrix([x, 0, z], rot));
  const thatch = VILLAGE_PALETTE.thatch;
  const thatchDark = VILLAGE_PALETTE.thatchDark;
  const thatchGold = VILLAGE_PALETTE.thatch;
  const door = VILLAGE_PALETTE.doorWood;
  const r = w * 0.52; // wall radius
  const plinthH = 0.62;
  const wallH = 1.95;
  const doorH = 1.65;
  const doorW = 0.85;
  const postR = r * 1.28;
  const thatchR = r * 1.55;
  const roofBaseY = plinthH + wallH;
  const roofPeakY = roofBaseY + 1.85;

  // packed earth apron
  p.part(
    new THREE.CircleGeometry(thatchR * 1.05, 16),
    VILLAGE_PALETTE.groundDirt,
    [0, 0.006, 0],
    [-Math.PI / 2, 0, 0],
    undefined,
    { receiveShadow: true },
  );

  // raised stone plinth (reference 60–80 cm)
  p.part(
    new THREE.CylinderGeometry(r * 1.1, r * 1.14, plinthH, 16),
    VILLAGE_PALETTE.wallStone,
    [0, plinthH / 2, 0],
    undefined,
    undefined,
    { roughness: 1, castShadow: true, receiveShadow: true },
  );
  // rubble facing stones
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    p.part(
      new THREE.BoxGeometry(0.28, 0.14 + (i % 3) * 0.05, 0.18),
      i % 2 ? VILLAGE_PALETTE.wallStone : VILLAGE_PALETTE.wallPale,
      [Math.cos(a) * r * 1.1, plinthH * (0.25 + (i % 4) * 0.15), Math.sin(a) * r * 1.1],
      [0, a, 0],
      undefined,
      { roughness: 1, castShadow: true },
    );
  }
  // pale lip on plinth
  p.part(
    new THREE.CylinderGeometry(r * 1.02, r * 1.04, 0.08, 16),
    VILLAGE_PALETTE.wallPale,
    [0, plinthH + 0.03, 0],
  );

  // thick mud walls
  p.part(
    new THREE.CylinderGeometry(r * 0.97, r * 1.01, wallH, 16),
    wall,
    [0, plinthH + wallH / 2, 0],
    undefined,
    undefined,
    { roughness: 0.98, castShadow: true, receiveShadow: true },
  );

  // broad white lime band (signature of the reference houses)
  p.part(
    new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.36, 16),
    "#e8dcc8",
    [0, plinthH + wallH * 0.42, 0],
  );
  p.part(
    new THREE.CylinderGeometry(r * 1.025, r * 1.025, 0.03, 16),
    VILLAGE_PALETTE.timberDark,
    [0, plinthH + wallH * 0.42 - 0.19, 0],
  );
  p.part(
    new THREE.CylinderGeometry(r * 1.025, r * 1.025, 0.03, 16),
    VILLAGE_PALETTE.timberDark,
    [0, plinthH + wallH * 0.42 + 0.19, 0],
  );

  // recessed door on +Z
  const doorZ = r * 0.92;
  p.part(new THREE.BoxGeometry(doorW * 1.12, doorH * 1.04, 0.35), "#1a120c", [
    0,
    plinthH + doorH / 2,
    doorZ,
  ]);
  p.part(
    new THREE.BoxGeometry(doorW * 0.44, doorH * 0.94, 0.05),
    door,
    [-doorW * 0.22, plinthH + doorH / 2, doorZ + 0.08],
    undefined,
    undefined,
    { castShadow: true },
  );
  p.part(
    new THREE.BoxGeometry(doorW * 0.44, doorH * 0.94, 0.05),
    door,
    [doorW * 0.22, plinthH + doorH / 2, doorZ + 0.08],
    undefined,
    undefined,
    { castShadow: true },
  );
  p.part(new THREE.BoxGeometry(doorW * 1.2, 0.1, 0.12), VILLAGE_PALETTE.timberDark, [
    0,
    plinthH + doorH + 0.05,
    doorZ + 0.05,
  ]);

  // small round-ish window opposite door
  p.part(new THREE.BoxGeometry(0.34, 0.28, 0.1), VILLAGE_PALETTE.windowDark, [
    0,
    plinthH + wallH * 0.68,
    -r * 0.98,
  ]);

  // veranda posts under eaves (12 posts — key reference detail)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.12;
    // skip posts at the door opening
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.35) continue;
    p.part(
      new THREE.CylinderGeometry(0.045, 0.055, wallH * 0.95, 5),
      VILLAGE_PALETTE.timberDark,
      [Math.cos(a) * postR, plinthH + wallH * 0.48, Math.sin(a) * postR],
      undefined,
      undefined,
      { castShadow: true },
    );
  }

  // layered conical thatch — deep overhang
  p.part(
    new THREE.ConeGeometry(thatchR * 0.92, 1.7, 16),
    thatchDark,
    [0, roofBaseY + 0.75, 0],
    undefined,
    undefined,
    { roughness: 1, castShadow: true },
  );
  p.part(
    new THREE.ConeGeometry(thatchR, 1.95, 16),
    thatch,
    [0, roofBaseY + 0.85, 0],
    undefined,
    undefined,
    { roughness: 0.95, castShadow: true },
  );
  // peak cap
  p.part(new THREE.ConeGeometry(thatchR * 0.22, 0.55, 8), thatchGold, [0, roofPeakY - 0.15, 0]);
  // thatch fringe around eaves
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    p.part(
      new THREE.BoxGeometry(0.14, 0.06, 0.28),
      i % 2 ? thatchDark : thatch,
      [Math.cos(a) * thatchR * 0.88, roofBaseY + 0.15, Math.sin(a) * thatchR * 0.88],
      [0.45, -a, 0],
    );
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
  for (const [x, z, r, n] of VILLAGE_WALLS) if (inChunk(x, z)) addCompoundWall(batch, x, z, r, n);
  for (const [x, z, s] of VILLAGE_ROCKS) if (inChunk(x, z)) addRock(batch, x, z, s);
  return batch.build();
}
