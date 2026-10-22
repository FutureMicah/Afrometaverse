import { describe, expect, it } from "vitest";
import { seasonForDay, weatherForDay, dayOfYear, SEASON_YEAR_DAYS } from "@/lib/seasons";
import { advanceHour, timeKeyForHour, nightStrength, sunSignal } from "@/lib/worldClock";
import { ChunkStreamer, CHUNK_SIZE, fogEndMeters, renderRadiusFor, chunkOf } from "@/lib/chunkStreaming";
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
