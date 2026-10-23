import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { PropBatch, Placer, groupMatrix } from "@/lib/propBatch";
import { buildChunkVillageProps, buildStaticVillageProps, VILLAGE_HUTS, VILLAGE_TREES, VILLAGE_ROCKS, VILLAGE_WALLS } from "@/lib/villageProps";
import { chunkOf } from "@/lib/chunkStreaming";

describe("prop batching (mobile draw calls)", () => {
  it("merges many parts sharing a material class into one geometry", () => {
    const batch = new PropBatch();
    const p = new Placer(batch);
    for (let i = 0; i < 20; i++) {
      p.part(new THREE.BoxGeometry(1, 1, 1), "#ffffff", [i, 0, 0]);
    }
    const out = batch.build();
    expect(batch.parts).toBe(0);
    expect(out.length).toBe(1);
    // 20 boxes, 24 verts each (non-indexed box = 36 verts), merged into one buffer
    expect(out[0]!.geometry.getAttribute("position").count).toBe(20 * 36);
  });

  it("keeps separate buckets for different shadow/material specs", () => {
    const batch = new PropBatch();
    const p = new Placer(batch);
    p.part(new THREE.BoxGeometry(1, 1, 1), "#ffffff", [0, 0, 0], undefined, undefined, { castShadow: true });
    p.part(new THREE.BoxGeometry(1, 1, 1), "#ffffff", [0, 0, 0], undefined, undefined, { castShadow: false });
    p.part(new THREE.BoxGeometry(1, 1, 1), "#ffffff", [0, 0, 0], undefined, undefined, { roughness: 0.5 });
    expect(batch.build().length).toBe(3);
  });

  it("applies the base transform to each part", () => {
    const batch = new PropBatch();
    const p = new Placer(batch, groupMatrix([10, 0, -4], 0));
    p.part(new THREE.BoxGeometry(1, 1, 1), "#ffffff", [0, 0, 0]);
    const [mesh] = batch.build();
    mesh!.geometry.computeBoundingBox();
    const c = new THREE.Vector3();
    mesh!.geometry.boundingBox!.getCenter(c);
    expect(c.x).toBeCloseTo(10);
    expect(c.z).toBeCloseTo(-4);
  });

  it("writes per-part colour into a vertex colour attribute", () => {
    const batch = new PropBatch();
    new Placer(batch).part(new THREE.BoxGeometry(1, 1, 1), "#ff0000", [0, 0, 0]);
    const [mesh] = batch.build();
    const col = mesh!.geometry.getAttribute("color");
    expect(col.getX(0)).toBeCloseTo(1);
    expect(col.getY(0)).toBeCloseTo(0);
  });
});

describe("village props chunking (batch1b streaming stays intact)", () => {
  it("every hut, tree, wall and rock falls into exactly one chunk", () => {
    const owners = new Map<string, number>();
    const bump = (x: number, z: number) => {
      const c = chunkOf(x, z);
      const k = `${c.cx},${c.cz}`;
      owners.set(k, (owners.get(k) ?? 0) + 1);
    };
    VILLAGE_HUTS.forEach((h) => bump(h.x, h.z));
    VILLAGE_TREES.forEach(([x, z]) => bump(x, z));
    VILLAGE_WALLS.forEach(([x, z]) => bump(x, z));
    VILLAGE_ROCKS.forEach(([x, z]) => bump(x, z));
    const total = [...owners.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(VILLAGE_HUTS.length + VILLAGE_TREES.length + VILLAGE_WALLS.length + VILLAGE_ROCKS.length);
  });

  it("builds merged chunk content only for chunks that hold props", () => {
    // the village sits in chunk (0,0) at the origin; far away there is nothing to build
    expect(buildChunkVillageProps({ cx: 0, cz: 0 }).length).toBeGreaterThan(0);
    expect(buildChunkVillageProps({ cx: 50, cz: 50 })).toEqual([]);
  });

  it("static dressing builds a small fixed set of merged meshes", () => {
    const parts = buildStaticVillageProps();
    expect(parts.length).toBeGreaterThan(0);
    expect(parts.length).toBeLessThan(12);
  });
});
