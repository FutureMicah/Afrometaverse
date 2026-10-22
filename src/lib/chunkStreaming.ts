/**
 * Chunked world streaming (era-progression-spec.md 10.3).
 * 64 m chunks. Render radius is 2 / 3 / 4 chunks by device tier. Load radius is one
 * chunk larger than render radius. A chunk outside the load radius unloads after a
 * 10 s grace period. At most one chunk loads per update.
 */

import type { RenderTier } from "./renderTier";

export const CHUNK_SIZE = 64;
export const UNLOAD_GRACE_SECONDS = 10;
export const MAX_CHUNK_LOADS_PER_UPDATE = 1;

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

export function chunkOf(x: number, z: number): ChunkCoord {
  return { cx: Math.floor(x / CHUNK_SIZE), cz: Math.floor(z / CHUNK_SIZE) };
}

export function renderRadiusFor(tier: RenderTier): number {
  return RENDER_RADIUS_BY_TIER[tier];
}

/** Fog end sits at the render radius edge, so nothing past it is drawn (10.3). */
export function fogEndMeters(tier: RenderTier): number {
  return renderRadiusFor(tier) * CHUNK_SIZE;
}

/** True when the chunk's square overlaps the world bounds. */
export function chunkIntersectsBounds(c: ChunkCoord, bounds: WorldBounds): boolean {
  const x0 = c.cx * CHUNK_SIZE;
  const z0 = c.cz * CHUNK_SIZE;
  return x0 < bounds.maxX && x0 + CHUNK_SIZE > bounds.minX && z0 < bounds.maxZ && z0 + CHUNK_SIZE > bounds.minZ;
}

export class ChunkStreamer {
  private readonly loaded = new Map<string, ChunkCoord>();
  private readonly unloadAt = new Map<string, number>();
  private readonly tier: RenderTier;
  private readonly bounds: WorldBounds | undefined;
  private readonly graceSeconds: number;

  /** Chunks that never unload (doors, interior anchors). Always treated as wanted. */
  private readonly pinned = new Set<string>();

  constructor(opts: { tier: RenderTier; bounds?: WorldBounds; graceSeconds?: number; pinned?: ChunkCoord[] }) {
    this.tier = opts.tier;
    this.bounds = opts.bounds ?? undefined;
    this.graceSeconds = opts.graceSeconds ?? UNLOAD_GRACE_SECONDS;
    for (const c of opts.pinned ?? []) this.pinned.add(chunkKey(c.cx, c.cz));
  }

  /** Pin a chunk so it stays loaded regardless of distance. */
  pin(cx: number, cz: number): void {
    this.pinned.add(chunkKey(cx, cz));
  }

  get renderRadius(): number {
    return renderRadiusFor(this.tier);
  }

  get loadedCount(): number {
    return this.loaded.size;
  }

  isLoaded(cx: number, cz: number): boolean {
    return this.loaded.has(chunkKey(cx, cz));
  }

  /** Call once per frame (or per throttled tick) with the player's position and a monotonic clock in seconds. */
  update(playerX: number, playerZ: number, nowSeconds: number): ChunkUpdate {
    const center = chunkOf(playerX, playerZ);
    const loadR = this.renderRadius + 1;
    const renderR = this.renderRadius;

    // Chunks wanted by the load radius, nearest first.
    const wanted: { c: ChunkCoord; d: number }[] = [];
    for (let dx = -loadR; dx <= loadR; dx++) {
      for (let dz = -loadR; dz <= loadR; dz++) {
        const c = { cx: center.cx + dx, cz: center.cz + dz };
        if (this.bounds && !chunkIntersectsBounds(c, this.bounds)) continue;
        wanted.push({ c, d: Math.max(Math.abs(dx), Math.abs(dz)) });
      }
    }
    wanted.sort((a, b) => a.d - b.d);

    const wantedKeys = new Set<string>();
    // Pinned chunks are always wanted: they load immediately and never start a grace timer.
    for (const key of this.pinned) {
      const [cx, cz] = key.split(",").map(Number);
      wanted.push({ c: { cx, cz }, d: 0 });
    }
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
      if (load.length >= MAX_CHUNK_LOADS_PER_UPDATE) break;
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
      if (Math.max(Math.abs(c.cx - center.cx), Math.abs(c.cz - center.cz)) <= renderR) visible.push(c);
    }

    return { load, unload, visible };
  }
}
