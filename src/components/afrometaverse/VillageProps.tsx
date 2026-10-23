import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { ChunkCoord } from "@/lib/chunkStreaming";
import type { MergedPropMesh } from "@/lib/propBatch";
import { buildChunkVillageProps, buildStaticVillageProps } from "@/lib/villageProps";

/**
 * Renders merged village props: one mesh per material class (see lib/propBatch.ts). Each mesh
 * uses vertex colours, so a whole chunk or the static dressing draws in a few calls.
 *
 * Geometry and materials are created once per mount and disposed on unmount, so chunks that
 * unload release their GPU buffers.
 */

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

function sharedMaterial(spec: MergedPropMesh["material"]): THREE.MeshStandardMaterial {
  const key = `${spec.roughness}|${spec.metalness}`;
  let m = materialCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      color: 0xffffff,
      roughness: spec.roughness,
      metalness: spec.metalness,
    });
    materialCache.set(key, m);
  }
  return m;
}

function MergedProps({ parts }: { parts: MergedPropMesh[] }) {
  useEffect(() => {
    return () => {
      for (const p of parts) p.geometry.dispose();
    };
  }, [parts]);

  return (
    <group>
      {parts.map((p, i) => (
        <mesh
          key={i}
          geometry={p.geometry}
          material={sharedMaterial(p.material)}
          castShadow={p.material.castShadow}
          receiveShadow={p.material.receiveShadow}
        />
      ))}
    </group>
  );
}

/** Always-loaded village dressing: roadside bushes, pots, grain, fence, market mats, grass pads. */
export function StaticVillageProps() {
  const parts = useMemo(() => buildStaticVillageProps(), []);
  return <MergedProps parts={parts} />;
}

/** Huts, trees, compound walls and rocks inside one streamed 64 m chunk. */
export function ChunkVillageProps({ chunk }: { chunk: ChunkCoord }) {
  const parts = useMemo(() => buildChunkVillageProps(chunk), [chunk.cx, chunk.cz]);
  return <MergedProps parts={parts} />;
}
