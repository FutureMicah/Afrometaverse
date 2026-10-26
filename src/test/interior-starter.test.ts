import { describe, expect, it } from "vitest";
import { STARTER } from "@/data/interiorStarter";
import { INTERIORS } from "@/data/interiors";
import { FLOOR_BOUNDS, RESERVED_RECTS } from "@/lib/hutGrid";
import type { InteriorId } from "@/stores/interiorStore";

const IDS = Object.keys(INTERIORS) as InteriorId[];

describe("interior starter furnishings", () => {
  it("gives every interior a starter set", () => {
    for (const id of IDS) {
      expect(STARTER[id].items.length).toBeGreaterThan(0);
    }
  });

  it("keeps every starter piece inside the room floor", () => {
    for (const id of IDS) {
      for (const it of STARTER[id].items) {
        expect(it.x, `${id}:${it.id}`).toBeGreaterThanOrEqual(FLOOR_BOUNDS.minX);
        expect(it.x, `${id}:${it.id}`).toBeLessThanOrEqual(FLOOR_BOUNDS.maxX);
        expect(it.z, `${id}:${it.id}`).toBeGreaterThanOrEqual(FLOOR_BOUNDS.minZ);
        expect(it.z, `${id}:${it.id}`).toBeLessThanOrEqual(FLOOR_BOUNDS.maxZ);
      }
    }
  });

  it("keeps the safehouse door and sleep spot clear of starter clutter", () => {
    // Pieces that sit on the floor (no y override) must stay out of the reserved rectangles.
    for (const it of STARTER.safehouse.items) {
      if (it.kind === "mat" && it.id === "sh-sleep-mat") continue;
      for (const r of RESERVED_RECTS) {
        const inside = it.x > r.minX && it.x < r.maxX && it.z > r.minZ && it.z < r.maxZ;
        expect(inside, `${it.id} sits in a reserved rect`).toBe(false);
      }
    }
  });

  it("only lists later items with a decor id and a how", () => {
    for (const id of IDS) {
      for (const l of STARTER[id].later) {
        expect(l.decorId.length).toBeGreaterThan(0);
        expect(["craft", "buy", "earn"]).toContain(l.how);
        if (l.how === "buy") expect(l.price).toBeGreaterThan(0);
      }
    }
  });
});
