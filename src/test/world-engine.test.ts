import { describe, expect, it } from "vitest";
import { seasonForDay, weatherForDay, dayOfYear, SEASON_YEAR_DAYS } from "@/lib/seasons";
import { advanceHour, timeKeyForHour, nightStrength, sunSignal } from "@/lib/worldClock";
import { ChunkStreamer, CHUNK_SIZE, fogEndMeters, renderRadiusFor, chunkOf, chunkKey } from "@/lib/chunkStreaming";
import { groupByChunk, itemsInChunk, chunksContaining, chunkOrigin } from "@/lib/chunkAssign";
import { detectRenderTier } from "@/lib/renderTier";
import { atmosphereAt, NIGHT_AMBIENT_FLOOR } from "@/lib/atmosphere";

describe("seasons (spec 12.2.2)", () => {
  it("runs a 112-day year of four 28-day seasons", () => {
    expect(SEASON_YEAR_DAYS).toBe(112);
    expect(seasonForDay(1)).toBe("rain");
    expect(seasonForDay(28)).toBe("rain");
    expect(seasonForDay(29)).toBe("harvest");
    expect(seasonForDay(57)).toBe("harmattan");
    expect(seasonForDay(85)).toBe("dry");
    expect(seasonForDay(113)).toBe("rain");
  });

  it("maps seasons to weather, with harmattan dusty and rain overcast", () => {
    expect(weatherForDay(1)).toBe("rainy");
    expect(weatherForDay(60)).toBe("harmattan");
    expect(weatherForDay(90)).toBe("dry");
  });

  it("wraps day numbers and handles zero or negative input", () => {
    expect(dayOfYear(113)).toBe(1);
    expect(dayOfYear(0)).toBe(112);
  });
});

describe("world clock", () => {
  it("advances 24 in-game hours in 24 real minutes by default", () => {
    expect(advanceHour(0, 24 * 60)).toBeCloseTo(0, 6);
    expect(advanceHour(0, 60)).toBeCloseTo(1, 6);
  });

  it("buckets hours into the coarse time of day", () => {
    expect(timeKeyForHour(7)).toBe("morning");
    expect(timeKeyForHour(13)).toBe("afternoon");
    expect(timeKeyForHour(18)).toBe("evening");
    expect(timeKeyForHour(23)).toBe("night");
  });

  it("is brightest at noon and darkest at midnight", () => {
    expect(sunSignal(12)).toBeCloseTo(1, 6);
    expect(nightStrength(0)).toBe(1);
    expect(nightStrength(12)).toBe(0);
  });
});

describe("chunk streaming (spec 10.3)", () => {
  it("uses 64 m chunks and tier radii 2 / 3 / 4", () => {
    expect(CHUNK_SIZE).toBe(64);
    expect(renderRadiusFor("low")).toBe(2);
    expect(renderRadiusFor("mid")).toBe(3);
    expect(renderRadiusFor("high")).toBe(4);
    expect(fogEndMeters("mid")).toBe(3 * 64);
  });

  it("loads chunks around the player and unloads only after the grace period", () => {
    const s = new ChunkStreamer({ tier: "low" });
    // Load up to one chunk per update; keep ticking until the radius is filled.
    for (let i = 0; i < 60; i++) s.update(0, 0, 0);
    expect(s.isLoaded(0, 0)).toBe(true);
    expect(s.loadedCount).toBe((2 * 3 + 1) ** 2);

    // Move the player far away. Old chunks must still be loaded during the 10 s grace.
    s.update(10_000, 0, 1);
    expect(s.isLoaded(0, 0)).toBe(true);
    s.update(10_000, 0, 9.9);
    expect(s.isLoaded(0, 0)).toBe(true);
    s.update(10_000, 0, 11.1);
    expect(s.isLoaded(0, 0)).toBe(false);
  });

  it("returns only chunks inside the render radius as visible", () => {
    const s = new ChunkStreamer({ tier: "low" });
    let res = s.update(0, 0, 0);
    for (let i = 0; i < 60; i++) res = s.update(0, 0, 0);
    expect(res.visible.length).toBe((2 * 2 + 1) ** 2);
    for (const c of res.visible) {
      expect(Math.max(Math.abs(c.cx), Math.abs(c.cz))).toBeLessThanOrEqual(2);
    }
  });

  it("maps positions to chunk coordinates", () => {
    expect(chunkOf(0, 0)).toEqual({ cx: 0, cz: 0 });
    expect(chunkOf(64, -1)).toEqual({ cx: 1, cz: -1 });
  });

  it("picks the render tier from device hints", () => {
    expect(detectRenderTier({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe("high");
    expect(detectRenderTier({ hardwareConcurrency: 4, deviceMemory: 4 })).toBe("high");
    expect(detectRenderTier({ mobile: true, hardwareConcurrency: 4, deviceMemory: 4 })).toBe("low");
    expect(detectRenderTier({ mobile: true, hardwareConcurrency: 8, deviceMemory: 8 })).toBe("high");
  });
});

describe("atmosphere (day/night + season)", () => {
  it("keeps an ambient floor at night so the village stays navigable", () => {
    const night = atmosphereAt(0, "rain", 192);
    expect(night.ambientIntensity).toBeGreaterThanOrEqual(NIGHT_AMBIENT_FLOOR);
    expect(night.starOpacity).toBeCloseTo(1, 1);
    expect(night.sunIntensity).toBe(0);
  });

  it("gives the sun its full intensity at noon and turns the stars off", () => {
    const noon = atmosphereAt(12, "dry", 192);
    expect(noon.sunIntensity).toBeGreaterThan(1);
    expect(noon.starOpacity).toBe(0);
  });

  it("thickens the fog in harmattan and shortens it in rain", () => {
    const rain = atmosphereAt(12, "rain", 192);
    const harm = atmosphereAt(12, "harmattan", 192);
    expect(harm.fogFar).toBeLessThan(192);
    expect(rain.fogFar).toBeLessThan(192);
  });
});

describe("chunk assignment (spec 10.3)", () => {
  const items = [
    { id: "hut-a", x: 5, z: 5 },
    { id: "hut-b", x: 63.9, z: 0.1 },
    { id: "hut-c", x: 64, z: 0 },
    { id: "tree-neg", x: -1, z: -1 },
  ];

  it("puts each item in the 64 m chunk its position falls in", () => {
    expect(chunkOf(63.9, 0.1)).toEqual({ cx: 0, cz: 0 });
    expect(chunkOf(64, 0)).toEqual({ cx: 1, cz: 0 });
    expect(chunkOf(-1, -1)).toEqual({ cx: -1, cz: -1 });
    const groups = groupByChunk(items);
    expect(groups.get(chunkKey(0, 0))?.items.map((i) => i.id)).toEqual(["hut-a", "hut-b"]);
    expect(groups.get(chunkKey(1, 0))?.items.map((i) => i.id)).toEqual(["hut-c"]);
    expect(groups.get(chunkKey(-1, -1))?.items.map((i) => i.id)).toEqual(["tree-neg"]);
  });

  it("returns only the items inside a given chunk, in original order", () => {
    expect(itemsInChunk(items, { cx: 0, cz: 0 }).map((i) => i.id)).toEqual(["hut-a", "hut-b"]);
    expect(itemsInChunk(items, { cx: 9, cz: 9 })).toEqual([]);
  });

  it("finds the distinct chunks that contain a set of anchors", () => {
    const chunks = chunksContaining([
      { x: 1, z: 1 },
      { x: 2, z: 2 },
      { x: 70, z: 1 },
    ]);
    expect(chunks.map((c) => chunkKey(c.cx, c.cz)).sort()).toEqual(["0,0", "1,0"]);
  });

  it("gives each chunk its world-space origin", () => {
    expect(chunkOrigin({ cx: 2, cz: -1 })).toEqual({ x: 2 * CHUNK_SIZE, z: -CHUNK_SIZE });
  });
});

describe("chunk pinning (door anchors stay loaded)", () => {
  it("keeps a pinned chunk loaded long after the player has left", () => {
    const s = new ChunkStreamer({ tier: "low", pinned: [{ cx: 5, cz: 0 }] });
    for (let i = 0; i < 80; i++) s.update(0, 0, 0);
    expect(s.isLoaded(5, 0)).toBe(true);
    // Move far away and let the grace period expire for every unpinned chunk.
    s.update(10_000, 0, 1);
    s.update(10_000, 0, 100);
    expect(s.isLoaded(0, 0)).toBe(false);
    expect(s.isLoaded(5, 0)).toBe(true);
  });

  it("pin() adds a pinned chunk at runtime", () => {
    const s = new ChunkStreamer({ tier: "low" });
    s.pin(7, 7);
    for (let i = 0; i < 80; i++) s.update(0, 0, 0);
    expect(s.isLoaded(7, 7)).toBe(true);
  });
});
