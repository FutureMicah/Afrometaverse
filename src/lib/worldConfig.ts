/**
 * High-polish world scale for AfroMetaverse.
 * Target: ~4× GTA San Andreas area ≈ 12 km × 12 km (144 km²).
 *
 * The full map is never loaded at once. ChunkStreamer only keeps a
 * ring of nearby chunks alive. This file is the single source of truth
 * for world extents, chunk sizing, and performance budgets.
 */

import type { RenderTier } from "./renderTier";

/** Full playable world side length in metres (12 km). */
export const WORLD_SIZE = 12_000;

/** Half extent — world is centred on the origin (village). */
export const WORLD_HALF = WORLD_SIZE / 2;

/** Chunk side length in metres. 128 m keeps draw calls reasonable at this scale. */
export const WORLD_CHUNK_SIZE = 128;

/** Hard world bounds used by the streamer (slightly inside the absolute edge). */
export const WORLD_BOUNDS = {
  minX: -WORLD_HALF,
  maxX: WORLD_HALF,
  minZ: -WORLD_HALF,
  maxZ: WORLD_HALF,
} as const;

/**
 * Render radius in chunks by device tier (high-polish values).
 * Fog end = radius × WORLD_CHUNK_SIZE.
 *   low  → 3 × 128 = 384 m
 *   mid  → 5 × 128 = 640 m
 *   high → 7 × 128 = 896 m
 */
export const WORLD_RENDER_RADIUS: Record<RenderTier, number> = {
  low: 3,
  mid: 5,
  high: 7,
};

/** Load radius is always one chunk beyond render radius. */
export function worldLoadRadius(tier: RenderTier): number {
  return WORLD_RENDER_RADIUS[tier] + 1;
}

/** Fog end distance in metres for the active tier. */
export function worldFogEnd(tier: RenderTier): number {
  return WORLD_RENDER_RADIUS[tier] * WORLD_CHUNK_SIZE;
}

/**
 * Approximate region labels for the large map (Port Harcourt / Rivers State inspired).
 * Used by biome sampling and content placement.
 */
export type WorldRegion =
  | "VILLAGE_CORE"   // starting settlement
  | "RIVERINE"       // creeks, mangroves, waterways
  | "SAVANNAH"       // northern open grasslands
  | "RAINFOREST"     // dense southern / eastern canopy
  | "PLATEAU"        // central elevated ground
  | "COASTAL"        // southern / western approaches to water
  | "HILLS"          // rocky rises
  | "OUTER_SETTLEMENT";

/** Convert world metres to chunk coordinates using the large-world chunk size. */
export function worldChunkOf(x: number, z: number): { cx: number; cz: number } {
  return {
    cx: Math.floor(x / WORLD_CHUNK_SIZE),
    cz: Math.floor(z / WORLD_CHUNK_SIZE),
  };
}

export function worldChunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

/** World-space origin (min corner) of a chunk. */
export function worldChunkOrigin(cx: number, cz: number): { x: number; z: number } {
  return { x: cx * WORLD_CHUNK_SIZE, z: cz * WORLD_CHUNK_SIZE };
}

/** Centre of a chunk in world space. */
export function worldChunkCentre(cx: number, cz: number): { x: number; z: number } {
  return {
    x: cx * WORLD_CHUNK_SIZE + WORLD_CHUNK_SIZE * 0.5,
    z: cz * WORLD_CHUNK_SIZE + WORLD_CHUNK_SIZE * 0.5,
  };
}
