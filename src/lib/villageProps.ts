import * as THREE from "three";
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
  // Market compound
  { x: -4.4, z: 3.8, style: "thatch", wall: "#c9a66b", w: 1.25, d: 1.1 },
  { x: -3.0, z: 4.4, style: "zinc", wall: "#b8956a", w: 1.35, d: 1.15, h: 1.05 },
  { x: -5.2, z: 2.6, style: "thatch", wall: "#b8895c", rot: 0.35, w: 1.2 },
  { x: -3.5, z: 2.0, style: "round", wall: "#d2b48c", w: 1.35, h: 1.0 },
  { x: -2.0, z: 3.2, style: "zinc", wall: "#a89070", rot: -0.25 },
  { x: -4.8, z: 4.6, style: "round", wall: "#c4a06a", w: 1.1, h: 0.9 },
  { x: -5.5, z: 3.5, style: "thatch", wall: "#c9a66b", rot: 0.6, w: 1.05 },
  // Civic
  { x: -1.4, z: -2.6, style: "thatch", wall: "#c4a06a", w: 1.3, d: 1.15 },
  { x: 1.5, z: -3.0, style: "zinc", wall: "#b0a090", w: 1.45, d: 1.25, h: 1.1 },
  { x: 0.15, z: -3.8, style: "round", wall: "#d4b896", w: 1.3, h: 1.05 },
  { x: 2.4, z: -1.6, style: "thatch", wall: "#c9a66b", rot: 0.45 },
  { x: -2.2, z: -1.4, style: "zinc", wall: "#9a8b78", w: 1.2 },
  { x: 0.6, z: -2.0, style: "thatch", wall: "#b8895c", rot: -0.2 },
  { x: -0.5, z: -3.2, style: "round", wall: "#c4a06a", w: 1.15 },
  // Creekside
  { x: -6.8, z: -2.8, style: "round", wall: "#c4a06a", w: 1.4, h: 1.05 },
  { x: -7.6, z: -4.2, style: "thatch", wall: "#b8895c", rot: 0.2, w: 1.25 },
  { x: -5.4, z: -4.4, style: "zinc", wall: "#a89070", w: 1.2 },
  { x: -8.0, z: -1.8, style: "thatch", wall: "#d2b48c", rot: -0.45 },
  { x: -6.2, z: -1.5, style: "round", wall: "#c9a66b", w: 1.15 },
  { x: -7.0, z: -5.0, style: "thatch", wall: "#b8895c", w: 1.1 },
  // Port edge
  { x: 5.4, z: 3.6, style: "zinc", wall: "#8a8070", w: 1.55, d: 1.25, h: 1.1 },
  { x: 6.8, z: 2.5, style: "thatch", wall: "#c4a06a", w: 1.2 },
  { x: 4.7, z: 1.7, style: "zinc", wall: "#9a8b78", rot: 0.3, w: 1.3 },
  { x: 7.4, z: 3.9, style: "round", wall: "#b8956a", w: 1.2 },
  { x: 6.0, z: 4.5, style: "thatch", wall: "#b8895c", rot: 0.15 },
  { x: 8.0, z: 2.8, style: "zinc", wall: "#8a8070", w: 1.15 },
  // Path-side
  { x: 1.7, z: 2.5, style: "thatch", wall: "#c9a66b", rot: 0.12 },
  { x: -0.9, z: 1.3, style: "zinc", wall: "#a89070" },
  { x: 3.9, z: -0.5, style: "thatch", wall: "#b8895c" },
  { x: -4.5, z: -0.3, style: "round", wall: "#d2b48c", w: 1.05 },
  { x: 2.8, z: 1.2, style: "round", wall: "#c4a06a", w: 1.0 },
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

/** Compound rings: centre x, z, radius, post count. */
export const VILLAGE_WALLS: Array<[number, number, number, number]> = [
  [-3.8, 3.4, 2.5, 12],
  [0.2, -2.6, 2.7, 12],
  [-6.8, -3.2, 2.35, 11],
  [6.2, 3.2, 2.4, 11],
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
  p.part(new THREE.SphereGeometry(0.32, 7, 7), "#3a5a28", [0, 0.28, 0], undefined, undefined, spec);
  p.part(new THREE.SphereGeometry(0.22, 6, 6), "#4a6b32", [0.18, 0.22, 0.1], undefined, undefined, spec);
  p.part(new THREE.SphereGeometry(0.2, 6, 6), "#2f4a20", [-0.14, 0.2, -0.08], undefined, undefined, spec);
}

export function addRock(batch: PropBatch, x: number, z: number, s: number): void {
  const p = new Placer(batch);
  p.part(
    new THREE.DodecahedronGeometry(0.35, 0),
    "#7a6a58",
    [x, 0.12 * s, z],
    [0.1, s * 2.1, 0.05],
    [s, s * 0.7, s],
    { roughness: 0.95, castShadow: true, receiveShadow: true },
  );
}

function addGrain(batch: PropBatch, x: number, z: number): void {
  const p = new Placer(batch, groupMatrix([x, 0, z]));
  p.part(new THREE.CylinderGeometry(0.35, 0.42, 0.7, 10), "#c4a05a", [0, 0.35, 0], undefined, undefined, { castShadow: true });
  p.part(new THREE.ConeGeometry(0.38, 0.25, 10), "#a88840", [0, 0.75, 0]);
}

function addPot(batch: PropBatch, x: number, z: number, s: number): void {
  new Placer(batch).part(new THREE.SphereGeometry(0.12, 8, 8), "#8a5a3a", [x, 0.12 * s, z], undefined, [s, s, s], {
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
      new THREE.BoxGeometry(0.14, 0.85, len * 0.95),
      "#c9a66b",
      [(px + qx) / 2, 0.4, (pz + qz) / 2],
      [0, ang, 0],
      undefined,
      { roughness: 0.98, castShadow: true, receiveShadow: true },
    );
  });
}

export function addHut(batch: PropBatch, spec: HutSpec): void {
  const { x, z, rot = 0, w = 1.15, d = 1.05, h = 0.95, style = "thatch", wall = "#c4a06a" } = spec;
  const p = new Placer(batch, groupMatrix([x, 0, z], rot));
  const thatch = "#7a5c28";
  const thatchDark = "#5c4218";
  const zinc = "#7d8b96";
  const door = "#2a1c10";
  const isRound = style === "round";
  const roofY = h + (isRound ? 0.42 : 0.28);

  // packed earth pad
  p.part(new THREE.CircleGeometry(Math.max(w, d) * 0.75, 12), "#a87848", [0, 0.01, 0], [-Math.PI / 2, 0, 0], undefined, {
    receiveShadow: true,
  });

  // walls
  p.part(
    isRound ? new THREE.CylinderGeometry(w * 0.52, w * 0.55, h, 12) : new THREE.BoxGeometry(w, h, d),
    wall,
    [0, h / 2, 0],
    undefined,
    undefined,
    { roughness: 0.98, castShadow: true, receiveShadow: true },
  );

  // plaster band
  p.part(
    isRound ? new THREE.CylinderGeometry(w * 0.56, w * 0.56, 0.18, 12) : new THREE.BoxGeometry(w * 1.04, 0.18, d * 1.04),
    "#d4b896",
    [0, 0.12, 0],
  );

  // door frame and lintel
  p.part(new THREE.BoxGeometry(0.32, h * 0.62, 0.04), door, [0, h * 0.38, isRound ? w * 0.52 : d / 2 + 0.015], undefined, undefined, {
    castShadow: true,
  });
  p.part(new THREE.BoxGeometry(0.38, 0.06, 0.05), "#4a3420", [0, h * 0.72, isRound ? w * 0.54 : d / 2 + 0.03]);

  // small window
  if (!isRound) {
    p.part(new THREE.PlaneGeometry(0.18, 0.16), "#1a1208", [w * 0.35, h * 0.55, d / 2 + 0.012]);
  }

  // roof
  if (isRound) {
    p.part(new THREE.ConeGeometry(w * 0.78, 0.85, 12), thatch, [0, roofY, 0], undefined, undefined, {
      roughness: 0.95,
      castShadow: true,
    });
    p.part(new THREE.ConeGeometry(w * 0.35, 0.35, 8), thatchDark, [0, roofY + 0.28, 0]);
  } else if (style === "zinc") {
    p.part(new THREE.BoxGeometry(w * 1.2, 0.06, d * 0.7), zinc, [0, roofY + 0.05, d * 0.18], [0.45, 0, 0], undefined, {
      roughness: 0.5,
      metalness: 0.4,
      castShadow: true,
    });
    p.part(new THREE.BoxGeometry(w * 1.2, 0.06, d * 0.7), zinc, [0, roofY + 0.05, -d * 0.18], [-0.45, 0, 0], undefined, {
      roughness: 0.55,
      metalness: 0.35,
      castShadow: true,
    });
    p.part(new THREE.BoxGeometry(w * 1.22, 0.05, 0.08), "#5a6570", [0, roofY + 0.22, 0], undefined, undefined, {
      roughness: 0.45,
      metalness: 0.5,
    });
  } else {
    p.part(new THREE.BoxGeometry(w * 1.25, 0.22, d * 0.75), thatch, [0, roofY + 0.08, d * 0.16], [0.42, 0, 0], undefined, {
      roughness: 0.98,
      castShadow: true,
    });
    p.part(new THREE.BoxGeometry(w * 1.25, 0.22, d * 0.75), thatchDark, [0, roofY + 0.08, -d * 0.16], [-0.42, 0, 0], undefined, {
      roughness: 0.98,
      castShadow: true,
    });
    p.part(new THREE.BoxGeometry(w * 1.15, 0.12, 0.15), "#6b4e20", [0, roofY + 0.28, 0]);
  }
}

export function addTree(batch: PropBatch, x: number, z: number, s: number, kind: TreeKind): void {
  const p = new Placer(batch, groupMatrix([x, 0, z], 0, [s, s, s]));
  if (kind === "palm") {
    p.part(new THREE.CylinderGeometry(0.07, 0.11, 2.2, 6), "#5c4030", [0, 1.1, 0], undefined, undefined, { castShadow: true });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      p.part(
        new THREE.BoxGeometry(0.12, 0.04, 0.9),
        "#3a6b28",
        [Math.cos(a) * 0.35, 2.15, Math.sin(a) * 0.35],
        [0.6, a, 0],
        undefined,
        { roughness: 0.9, castShadow: true },
      );
    }
    return;
  }
  const trunkH = kind === "broad" ? 1.8 : 1.45;
  p.part(new THREE.CylinderGeometry(0.09, 0.14, trunkH, 7), "#3f2a18", [0, trunkH / 2, 0], undefined, undefined, { castShadow: true });
  p.part(new THREE.SphereGeometry(kind === "broad" ? 0.85 : 0.6, 9, 9), "#355528", [0, trunkH + 0.15, 0], undefined, undefined, {
    roughness: 0.88,
    castShadow: true,
  });
  p.part(new THREE.SphereGeometry(0.45, 8, 8), "#4a6b30", [0.35, trunkH + 0.35, 0.15], undefined, undefined, {
    roughness: 0.9,
    castShadow: true,
  });
  p.part(new THREE.SphereGeometry(0.4, 8, 8), "#2a451c", [-0.3, trunkH + 0.25, -0.2], undefined, undefined, {
    roughness: 0.92,
    castShadow: true,
  });
  if (kind === "broad") {
    p.part(new THREE.SphereGeometry(0.5, 8, 8), "#3d5c28", [0.1, trunkH + 0.55, -0.25], undefined, undefined, {
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
    fence.part(new THREE.BoxGeometry(0.05, 0.76, 0.05), "#5c4030", [-3.2 + i * 0.35, 0.38, 5.15], undefined, undefined, {
      castShadow: true,
    });
  }
  fence.part(new THREE.BoxGeometry(2.6, 0.04, 0.04), "#6b4e32", [-1.95, 0.55, 5.15], undefined, undefined, { roughness: 1 });

  // market mats: a top slab on four legs each
  for (const [mx, mz] of MARKET_MATS) {
    const m = new Placer(batch, groupMatrix([mx, 0, mz]));
    m.part(new THREE.BoxGeometry(0.95, 0.05, 0.48), "#6b5340", [0, 0.48, 0], undefined, undefined, {
      roughness: 0.9,
      castShadow: true,
    });
    for (const [lx, lz] of MARKET_MAT_LEGS) {
      m.part(new THREE.BoxGeometry(0.05, 0.48, 0.05), "#4a3728", [lx, 0.24, lz]);
    }
  }

  // grass pads
  const pads = new Placer(batch);
  GRASS_PAD_POINTS.forEach(([gx, gz], i) => {
    pads.part(
      new THREE.CircleGeometry(1.0 + (i % 3) * 0.25, 10),
      i % 2 ? "#7a8a3a" : "#4a5c28",
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
