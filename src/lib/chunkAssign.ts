import { CHUNK_SIZE, chunkKey, chunkOf, type ChunkCoord } from "@/lib/chunkStreaming";

/** A world-space point on the ground plane. */
export interface GroundPoint {
  x: number;
  z: number;
}

/**
 * Group items by the 64 m chunk their position falls in.
 * Items keep their original order inside each chunk.
 */
export function groupByChunk<T extends GroundPoint>(items: readonly T[]): Map<string, { chunk: ChunkCoord; items: T[] }> {
  const out = new Map<string, { chunk: ChunkCoord; items: T[] }>();
  for (const item of items) {
    const chunk = chunkOf(item.x, item.z);
    const key = chunkKey(chunk.cx, chunk.cz);
    let bucket = out.get(key);
    if (!bucket) {
      bucket = { chunk, items: [] };
      out.set(key, bucket);
    }
    bucket.items.push(item);
  }
  return out;
}

/** Items whose position falls inside the given chunk. */
export function itemsInChunk<T extends GroundPoint>(items: readonly T[], chunk: ChunkCoord): T[] {
  return items.filter((it) => {
    const c = chunkOf(it.x, it.z);
    return c.cx === chunk.cx && c.cz === chunk.cz;
  });
}

/** Distinct chunks that contain at least one of the points (used to pin interactive anchors). */
export function chunksContaining(points: readonly GroundPoint[]): ChunkCoord[] {
  const seen = new Map<string, ChunkCoord>();
  for (const p of points) {
    const c = chunkOf(p.x, p.z);
    seen.set(chunkKey(c.cx, c.cz), c);
  }
  return [...seen.values()];
}

/** World-space origin of a chunk (its min-x, min-z corner). */
export function chunkOrigin(c: ChunkCoord): GroundPoint {
  return { x: c.cx * CHUNK_SIZE, z: c.cz * CHUNK_SIZE };
}
