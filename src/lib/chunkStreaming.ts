/**
 * Chunked world streaming — high-polish large-world version.
 *
 * Supports both the original 64 m village-scale chunks and the new
 * 128 m world-scale chunks (see worldConfig.ts). The full ~12 km map
 * is never loaded at once; only a ring around the player stays alive.
 */

import type { RenderTier } from "./renderTier";
import {
  WORLD_BOUNDS,
  WORLD_CHUNK_SIZE,
  WORLD_RENDER_RADIUS,
  worldFogEnd,
} from "./worldConfig";

/** Default remains 64 for village-scale systems that still use it. */
export const CHUNK_SIZE = 64;
export const UNLOAD_GRACE_SECONDS = 12;
export const MAX_CHUNK_LOADS_PER_UPDATE = 2;

/** Legacy radii (village-scale). Prefer WORLD_RENDER_RADIUS for the large map. */
export const RENDER_RADIUS_BY_TIER: Record<RenderTier, number> = {
  low: 2,
  mid: 3,
  high: 4,
};

export interface ChunkCoord {
  cx: number;
  cz: number;
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ChunkUpdate {
  /** Chunks that should be loaded this update (already recorded as loaded). */
  load: ChunkCoord[];
  /** Chunks whose grace period expired this update (already removed from loaded). */
  unload: ChunkCoord[];
  /** Loaded chunks inside the render radius. These are the ones to draw. */
  visible: ChunkCoord[];
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function chunkOf(x: number, z: number, size = CHUNK_SIZE): ChunkCoord {
  return { cx: Math.floor(x / size), cz: Math.floor(z / size) };
}

export function renderRadiusFor(tier: RenderTier): number {
  return RENDER_RADIUS_BY_TIER[tier];
}

/** Fog end sits at the render radius edge (legacy 64 m chunks). */
export function fogEndMeters(tier: RenderTier): number {
  return renderRadiusFor(tier) * CHUNK_SIZE;
}

/** True when the chunk's square overlaps the world bounds. */
export function chunkIntersectsBounds(
  c: ChunkCoord,
  bounds: WorldBounds,
  size = CHUNK_SIZE,
): boolean {
  const x0 = c.cx * size;
  const z0 = c.cz * size;
  return (
    x0 < bounds.maxX &&
    x0 + size > bounds.minX &&
    z0 < bounds.maxZ &&
    z0 + size > bounds.minZ
  );
}

export interface ChunkStreamerOptions {
  tier: RenderTier;
  /** Chunk side length. Use WORLD_CHUNK_SIZE (128) for the large map. */
  chunkSize?: number;
  /** Explicit bounds. Defaults to the full 12 km world when using large chunks. */
  bounds?: WorldBounds;
  graceSeconds?: number;
  pinned?: ChunkCoord[];
  /** Override render radius (in chunks). */
  renderRadius?: number;
  /** Max new chunks accepted per update (spread load). */
  maxLoadsPerUpdate?: number;
}

export class ChunkStreamer {
  private readonly loaded = new Map<string, ChunkCoord>();
  private readonly unloadAt = new Map<string, number>();
  private readonly tier: RenderTier;
  private readonly chunkSize: number;
  private readonly bounds: WorldBounds | undefined;
  private readonly graceSeconds: number;
  private readonly renderR: number;
  private readonly maxLoads: number;

  /** Chunks that never unload (doors, interior anchors). Always treated as wanted. */
  private readonly pinned = new Set<string>();

  constructor(opts: ChunkStreamerOptions) {
    this.tier = opts.tier;
    this.chunkSize = opts.chunkSize ?? CHUNK_SIZE;
    this.bounds =
      opts.bounds ??
      (this.chunkSize >= WORLD_CHUNK_SIZE ? { ...WORLD_BOUNDS } : undefined);
    this.graceSeconds = opts.graceSeconds ?? UNLOAD_GRACE_SECONDS;
    this.renderR =
      opts.renderRadius ??
      (this.chunkSize >= WORLD_CHUNK_SIZE
        ? WORLD_RENDER_RADIUS[opts.tier]
        : RENDER_RADIUS_BY_TIER[opts.tier]);
    this.maxLoads = opts.maxLoadsPerUpdate ?? MAX_CHUNK_LOADS_PER_UPDATE;
    for (const c of opts.pinned ?? []) this.pinned.add(chunkKey(c.cx, c.cz));
  }

  /** Pin a chunk so it stays loaded regardless of distance. */
  pin(cx: number, cz: number): void {
    this.pinned.add(chunkKey(cx, cz));
  }

  get renderRadius(): number {
    return this.renderR;
  }

  get size(): number {
    return this.chunkSize;
  }

  get loadedCount(): number {
    return this.loaded.size;
  }

  /** Fog end distance for the active configuration. */
  get fogEnd(): number {
    return this.renderR * this.chunkSize;
  }

  isLoaded(cx: number, cz: number): boolean {
    return this.loaded.has(chunkKey(cx, cz));
  }

  /** Call once per frame (or per throttled tick) with the player's position and a monotonic clock in seconds. */
  update(playerX: number, playerZ: number, nowSeconds: number): ChunkUpdate {
    const center = chunkOf(playerX, playerZ, this.chunkSize);
    const loadR = this.renderR + 1;
    const renderR = this.renderR;

    // Chunks wanted by the load radius, nearest first.
    const wanted: { c: ChunkCoord; d: number }[] = [];
    for (let dx = -loadR; dx <= loadR; dx++) {
      for (let dz = -loadR; dz <= loadR; dz++) {
        const c = { cx: center.cx + dx, cz: center.cz + dz };
        if (this.bounds && !chunkIntersectsBounds(c, this.bounds, this.chunkSize)) continue;
        wanted.push({ c, d: Math.max(Math.abs(dx), Math.abs(dz)) });
      }
    }
    wanted.sort((a, b) => a.d - b.d);

    // Pinned chunks are always wanted.
    for (const key of this.pinned) {
      const [cx = 0, cz = 0] = key.split(",").map(Number);
      wanted.push({ c: { cx, cz }, d: 0 });
    }

    const wantedKeys = new Set<string>();
    const load: ChunkCoord[] = [];

    for (const { c } of wanted) {
      const key = chunkKey(c.cx, c.cz);
      wantedKeys.add(key);
      if (this.loaded.has(key)) {
        // Back inside the load radius: cancel any pending unload.
        this.unloadAt.delete(key);
      }
    }

    for (const { c } of wanted) {
      if (load.length >= this.maxLoads) break;
      const key = chunkKey(c.cx, c.cz);
      if (!this.loaded.has(key)) {
        this.loaded.set(key, c);
        load.push(c);
      }
    }

    // Chunks outside the load radius start a grace timer, then unload when it expires.
    const unload: ChunkCoord[] = [];
    for (const [key, c] of this.loaded) {
      if (wantedKeys.has(key)) continue;
      if (!this.unloadAt.has(key)) {
        this.unloadAt.set(key, nowSeconds + this.graceSeconds);
        continue;
      }
      if (nowSeconds >= (this.unloadAt.get(key) as number)) {
        this.loaded.delete(key);
        this.unloadAt.delete(key);
        unload.push(c);
      }
    }

    const visible: ChunkCoord[] = [];
    for (const c of this.loaded.values()) {
      if (Math.max(Math.abs(c.cx - center.cx), Math.abs(c.cz - center.cz)) <= renderR) {
        visible.push(c);
      }
    }

    return { load, unload, visible };
  }
}

/** Convenience: fog end for the large-world configuration. */
export function largeWorldFogEnd(tier: RenderTier): number {
  return worldFogEnd(tier);
}
