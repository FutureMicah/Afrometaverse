/**
 * Procedural generation for the full ~12 km AfroMetaverse map.
 * Deterministic, seedable, and cheap enough to call per-chunk or per-prop.
 *
 * Height and biome functions are continuous across the whole world so
 * streaming chunks join without seams.
 */

import {
  WORLD_HALF,
  WORLD_SIZE,
  type WorldRegion,
} from "./worldConfig";

/** Simple deterministic hash → [0, 1) */
function hash2(x: number, z: number, salt = 0): number {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Value noise style sample */
function noise2(x: number, z: number, salt = 0): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, salt);
  const b = hash2(ix + 1, iz, salt);
  const c = hash2(ix, iz + 1, salt);
  const d = hash2(ix + 1, iz + 1, salt);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/** Fractal Brownian motion */
function fbm(x: number, z: number, octaves = 4, salt = 0): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    v += a * noise2(x * f, z * f, salt + i * 17);
    a *= 0.5;
    f *= 2;
  }
  return v;
}

/**
 * Normalised world coordinates: −1 … +1 across the full map.
 * Origin (0,0) is the village centre.
 */
export function toNorm(x: number, z: number): { nx: number; nz: number; r: number } {
  const nx = x / WORLD_HALF;
  const nz = z / WORLD_HALF;
  return { nx, nz, r: Math.hypot(nx, nz) };
}

/**
 * Continuous height field in metres.
 * Village core (r < ~120 m) stays nearly flat at y ≈ 0 so the detailed
 * HeritageTerrain and all existing props sit correctly. Outside that
 * zone the full procedural landscape takes over with no hard seam.
 */
export function sampleHeight(x: number, z: number): number {
  const { nx, nz, r } = toNorm(x, z);

  // Soft village flat zone — fully flat inside ~80 m, blends out by ~180 m
  // (HeritageTerrain is 200 m across, so the outer ring of the core terrain
  // already matches the streamed world heights.)
  const coreFlat = 1 - smoothstep(0.013, 0.03, r); // ~80 m → ~180 m

  // Broad continental shape
  let h = fbm(nx * 1.8, nz * 1.8, 5, 1) * 18;

  // Northern savannah rise
  h += smoothstep(0.15, 0.55, -nz) * 6;

  // Southern / eastern rainforest undulation
  h += smoothstep(0.2, 0.7, nz) * fbm(nx * 3.2, nz * 3.2, 3, 4) * 9;

  // Western coastal drop toward water
  h -= smoothstep(0.35, 0.85, -nx) * 7;

  // River valley cut (meanders roughly NW → SE)
  const riverLine = nz - nx * 0.55 + 0.08;
  const riverDist = Math.abs(riverLine);
  const riverInfluence = 1 - smoothstep(0.02, 0.09, riverDist);
  h -= riverInfluence * 5.5;

  // Rocky hills (NE & NW)
  const hillNE = Math.exp(-((nx - 0.55) ** 2) * 8 - ((nz + 0.35) ** 2) * 6);
  const hillNW = Math.exp(-((nx + 0.6) ** 2) * 7 - ((nz + 0.25) ** 2) * 9);
  h += (hillNE * 14 + hillNW * 11) * (0.6 + fbm(nx * 4, nz * 4, 2, 9) * 0.4);

  // Keep core almost flat so village props / roads / interiors stay valid
  h *= 1 - coreFlat * 0.97;

  // Gentle overall slope so water drains toward the south-west
  h += (-nz * 1.8 - nx * 0.9) * (1 - coreFlat);

  return h;
}

/** True when a world position is inside the always-loaded detailed village core. */
export function isVillageCore(x: number, z: number, radius = 110): boolean {
  return Math.hypot(x, z) < radius;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Biome / region classification used by flora, architecture and atmosphere.
 */
export function sampleRegion(x: number, z: number): WorldRegion {
  const { nx, nz, r } = toNorm(x, z);

  if (r < 0.06) return "VILLAGE_CORE";

  // River corridor
  const riverLine = nz - nx * 0.55 + 0.08;
  if (Math.abs(riverLine) < 0.07 && r > 0.05) return "RIVERINE";

  // Coastal approaches (west / south-west)
  if (nx < -0.35 && nz > -0.15) return "COASTAL";

  // Northern open land
  if (nz < -0.28) return "SAVANNAH";

  // Rocky rises
  const hillNE = Math.exp(-((nx - 0.55) ** 2) * 8 - ((nz + 0.35) ** 2) * 6);
  const hillNW = Math.exp(-((nx + 0.6) ** 2) * 7 - ((nz + 0.25) ** 2) * 9);
  if (hillNE > 0.35 || hillNW > 0.35) return "HILLS";

  // Dense canopy (south-east and parts of east)
  if (nx > 0.15 && nz > 0.1) return "RAINFOREST";

  // Scattered outer settlements
  if (r > 0.45 && hash2(Math.floor(x / 180), Math.floor(z / 180), 22) > 0.78) {
    return "OUTER_SETTLEMENT";
  }

  return "PLATEAU";
}

/** Backwards-compatible biome id used by older HeritageTerrain helpers. */
export type BiomeId = "SAVANNAH" | "PLATEAU" | "MOUNTAIN" | "COASTAL";

export function sampleBiome(x: number, z: number): BiomeId {
  const region = sampleRegion(x, z);
  switch (region) {
    case "SAVANNAH":
      return "SAVANNAH";
    case "HILLS":
      return "MOUNTAIN";
    case "COASTAL":
    case "RIVERINE":
      return "COASTAL";
    default:
      return "PLATEAU";
  }
}

/**
 * Suggested ground colour (sRGB 0–1) for a world position.
 * Useful for cheap far-LOD terrain tiles.
 */
export function sampleGroundColor(x: number, z: number): [number, number, number] {
  const region = sampleRegion(x, z);
  const n = fbm(x * 0.02, z * 0.02, 2, 3);
  switch (region) {
    case "SAVANNAH":
      return [0.55 + n * 0.08, 0.32 + n * 0.05, 0.16];
    case "RAINFOREST":
      return [0.18 + n * 0.06, 0.32 + n * 0.08, 0.14];
    case "HILLS":
      return [0.3 + n * 0.05, 0.28, 0.25];
    case "COASTAL":
    case "RIVERINE":
      return [0.72 + n * 0.06, 0.64, 0.45];
    case "VILLAGE_CORE":
      return [0.42, 0.48, 0.22];
    default:
      return [0.34 + n * 0.06, 0.46, 0.2];
  }
}

/** Density hint (0–1) for flora / props in a region. */
export function sampleContentDensity(x: number, z: number): number {
  const region = sampleRegion(x, z);
  const base: Record<WorldRegion, number> = {
    VILLAGE_CORE: 0.15,
    RIVERINE: 0.55,
    SAVANNAH: 0.35,
    RAINFOREST: 0.9,
    PLATEAU: 0.5,
    COASTAL: 0.4,
    HILLS: 0.3,
    OUTER_SETTLEMENT: 0.65,
  };
  return base[region] * (0.75 + hash2(Math.floor(x / 64), Math.floor(z / 64), 8) * 0.5);
}

export { WORLD_SIZE, WORLD_HALF };
