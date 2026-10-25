import { describe, it, expect } from "vitest";
import { WORLD_BOUNDS, POND, MAIN_ROAD_Z, MAIN_ROAD_HALF, CHIEF_COMPOUND, MARKET_SQUARE, FARM } from "@/lib/villageLayout";
import { VILLAGE_HUTS, VILLAGE_TREES, VILLAGE_ROCKS, hutRadius } from "@/lib/villageProps";
import { chunkIntersectsBounds, chunkOf } from "@/lib/chunkStreaming";

const inBounds = (x: number, z: number, pad = 0) =>
  x >= WORLD_BOUNDS.minX + pad && x <= WORLD_BOUNDS.maxX - pad && z >= WORLD_BOUNDS.minZ + pad && z <= WORLD_BOUNDS.maxZ - pad;

describe("spread village layout", () => {
  it("every hut sits inside the world footprint", () => {
    for (const h of VILLAGE_HUTS) expect(inBounds(h.x, h.z, hutRadius(h)), `hut ${h.x},${h.z}`).toBe(true);
  });

  it("no hut overlaps the pond or the main road band", () => {
    for (const h of VILLAGE_HUTS) {
      const r = hutRadius(h);
      expect(Math.hypot(h.x - POND.x, h.z - POND.z) > POND.r + r, `pond ${h.x},${h.z}`).toBe(true);
      expect(Math.abs(h.z - MAIN_ROAD_Z) > MAIN_ROAD_HALF + r, `road ${h.x},${h.z}`).toBe(true);
    }
  });

  it("trees and rocks stay in bounds and off the main road", () => {
    for (const [x, z] of VILLAGE_TREES) {
      expect(inBounds(x, z), `tree ${x},${z}`).toBe(true);
      expect(Math.abs(z - MAIN_ROAD_Z) > MAIN_ROAD_HALF, `tree on road ${x},${z}`).toBe(true);
    }
    for (const [x, z] of VILLAGE_ROCKS) expect(inBounds(x, z), `rock ${x},${z}`).toBe(true);
  });

  it("the four district landmarks are inside the footprint", () => {
    for (const p of [MARKET_SQUARE, CHIEF_COMPOUND, FARM]) expect(inBounds(p.x, p.z)).toBe(true);
  });

  it("chunks that touch the world bounds stream, chunks well outside do not", () => {
    expect(chunkIntersectsBounds(chunkOf(0, 0), WORLD_BOUNDS)).toBe(true);
    expect(chunkIntersectsBounds(chunkOf(400, 400), WORLD_BOUNDS)).toBe(false);
  });
});
