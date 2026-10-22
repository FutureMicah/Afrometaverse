import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ChunkStreamer, chunkKey, type ChunkCoord } from "@/lib/chunkStreaming";
import { currentRenderTier, type RenderTier } from "@/lib/renderTier";

/**
 * Chunked world streaming (era-progression-spec.md 10.3).
 *
 * The world is divided into 64 m chunks. ChunkStreamer decides which chunks are loaded (render
 * radius + 1), which are drawn (render radius, also the fog end), and which unload after the
 * 10 s grace period. Each chunk is one grouped mesh: ground tile plus its instanced flora, so the
 * draw cost of a chunk is a fixed small number of calls no matter how much detail it holds.
 *
 * This component owns streaming only. The village core (HeritageTerrain, roads, huts) stays in the
 * scene, so the existing look is unchanged while the streamer proves the architecture.
 */

interface ChunkedWorldProps {
  tier?: RenderTier;
  /** Read each frame for the stream centre. Falls back to the camera. */
  focusRef?: React.RefObject<THREE.Object3D | null>;
  /** Optional builder that returns the static content for a chunk (ground, flora, props). */
  buildChunk?: (chunk: ChunkCoord) => React.ReactNode;
  /** Chunks that never unload (doors, interior anchors). */
  pinned?: ChunkCoord[];
}

export function ChunkedWorld({ tier, focusRef, buildChunk, pinned }: ChunkedWorldProps) {
  const resolvedTier = tier ?? currentRenderTier();
  const camera = useThree((s) => s.camera);
  const streamer = useMemo(() => new ChunkStreamer({ tier: resolvedTier, pinned }), [resolvedTier]);
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
        // buildChunk emits world-space content, so the chunk group is not offset.
        <group key={chunkKey(c.cx, c.cz)}>{buildChunk ? buildChunk(c) : null}</group>
      ))}
    </group>
  );
}
