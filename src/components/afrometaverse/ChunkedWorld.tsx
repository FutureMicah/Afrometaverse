import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ChunkStreamer, chunkKey, type ChunkCoord } from "@/lib/chunkStreaming";
import { currentRenderTier, type RenderTier } from "@/lib/renderTier";
import { WORLD_CHUNK_SIZE, WORLD_BOUNDS } from "@/lib/worldConfig";

/**
 * Chunked world streaming (high-polish large-map version).
 *
 * Two modes:
 *  - village (default): 64 m chunks, original radii — used around the core settlement
 *  - world: 128 m chunks, larger radii, full 12 km bounds — used for the expanded map
 *
 * Each visible chunk is built once via `buildChunk` and stays mounted until the
 * streamer unloads it after the grace period.
 */

interface ChunkedWorldProps {
  tier?: RenderTier;
  /** Read each frame for the stream centre. Falls back to the camera. */
  focusRef?: React.RefObject<THREE.Object3D | null>;
  /** Optional builder that returns the static content for a chunk (ground, flora, props). */
  buildChunk?: (chunk: ChunkCoord) => React.ReactNode;
  /** Chunks that never unload (doors, interior anchors). */
  pinned?: ChunkCoord[];
  /**
   * "village" = 64 m legacy chunks around the settlement.
   * "world"   = 128 m chunks across the full 12 km map (high polish).
   */
  mode?: "village" | "world";
  /** Override max new chunks loaded per frame (default 2). */
  maxLoadsPerUpdate?: number;
}

export function ChunkedWorld({
  tier,
  focusRef,
  buildChunk,
  pinned,
  mode = "village",
  maxLoadsPerUpdate,
}: ChunkedWorldProps) {
  const resolvedTier = tier ?? currentRenderTier();
  const camera = useThree((s) => s.camera);

  const streamer = useMemo(() => {
    if (mode === "world") {
      return new ChunkStreamer({
        tier: resolvedTier,
        chunkSize: WORLD_CHUNK_SIZE,
        bounds: { ...WORLD_BOUNDS },
        pinned,
        maxLoadsPerUpdate: maxLoadsPerUpdate ?? 2,
      });
    }
    return new ChunkStreamer({
      tier: resolvedTier,
      ...(pinned ? { pinned } : {}),
      maxLoadsPerUpdate: maxLoadsPerUpdate ?? 1,
    });
  }, [resolvedTier, mode, pinned, maxLoadsPerUpdate]);

  const [visible, setVisible] = useState<ChunkCoord[]>([]);
  const lastKey = useRef("");
  const clock = useRef(0);

  useEffect(() => {
    const tick = streamer.update(0, 0, 0);
    setVisible(tick.visible);
    lastKey.current = tick.visible.map((c) => chunkKey(c.cx, c.cz)).sort().join("|");
  }, [streamer]);

  useFrame((_, dt) => {
    clock.current += dt;
    const target = focusRef?.current ?? camera;
    const update = streamer.update(target.position.x, target.position.z, clock.current);
    const key = update.visible.map((c) => chunkKey(c.cx, c.cz)).sort().join("|");
    if (key !== lastKey.current) {
      lastKey.current = key;
      setVisible(update.visible);
    }
  });

  return (
    <group>
      {visible.map((c) => (
        <group key={chunkKey(c.cx, c.cz)}>
          {buildChunk ? buildChunk(c) : null}
        </group>
      ))}
    </group>
  );
}
