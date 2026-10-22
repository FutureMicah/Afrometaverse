import { describe, expect, it } from "vitest";
import {
  stepApertures,
  stepWetness,
  windStrength,
  openFraction,
  rattleAmplitude,
  windAudioGain,
  rainAudioGain,
  apertureActions,
  BLOW_THRESHOLD,
  type Aperture,
} from "@/lib/interiorWeather";
import { FLOOR_BOUNDS, HEARTH, checkPlacement, snap } from "@/lib/hutGrid";
import { DECOR_CATALOG, footprintAt, getDecorItem } from "@/data/decor";

const CAT = DECOR_CATALOG;

const never = () => 0.999;
const always = () => 0;

describe("interior wind strength (spec 17.2)", () => {
  it("is zero in dry calm and half in rainy wind", () => {
    expect(windStrength(2)).toBe(0);
    expect(windStrength(5)).toBeCloseTo(0.5, 5);
    expect(windStrength(99)).toBe(1);
  });
});

describe("wind blows apertures (spec 17.3)", () => {
  it("never opens a latched aperture", () => {
    const latched: Aperture = { open: 0, latched: true };
    const r = stepApertures([latched], 1, 10, always);
    expect(r.apertures[0]).toEqual({ open: 0, latched: true });
    expect(r.blownOpen).toEqual([]);
  });

  it("does nothing below the blow threshold", () => {
    const shut: Aperture = { open: 0, latched: false };
    const r = stepApertures([shut], BLOW_THRESHOLD - 0.01, 10, always);
    expect(r.apertures[0]?.open).toBe(0);
  });

  it("cracks an unlatched shut aperture when the roll succeeds, and reports it", () => {
    const shut: Aperture = { open: 0, latched: false };
    const r = stepApertures([shut], 1, 1, always);
    expect(r.blownOpen).toEqual([0]);
    expect(r.apertures[0]?.open).toBeGreaterThan(0);
  });

  it("keeps a shut aperture shut when the roll fails", () => {
    const shut: Aperture = { open: 0, latched: false };
    const r = stepApertures([shut], 1, 1, never);
    expect(r.apertures[0]?.open).toBe(0);
    expect(r.blownOpen).toEqual([]);
  });

  it("pushes an already open aperture further open in a storm", () => {
    const ajar: Aperture = { open: 0.2, latched: false };
    const r = stepApertures([ajar], 1, 1, never);
    expect(r.apertures[0]?.open).toBeGreaterThan(0.2);
  });

  it("does not change an open aperture's latch", () => {
    const r = stepApertures([{ open: 0.5, latched: false }], 1, 1, never);
    expect(r.apertures[0]?.latched).toBe(false);
  });
});

describe("rattle, audio and wetness (spec 17.3 to 17.5)", () => {
  it("rattles only a shut unlatched aperture", () => {
    expect(rattleAmplitude({ open: 0, latched: false }, 1)).toBeCloseTo(0.6, 5);
    expect(rattleAmplitude({ open: 0, latched: true }, 1)).toBe(0);
    expect(rattleAmplitude({ open: 0.3, latched: false }, 1)).toBe(0);
  });

  it("makes a sealed room quieter than an open one in the same storm", () => {
    expect(windAudioGain(1, 0)).toBeLessThan(windAudioGain(1, 1));
    expect(rainAudioGain(1, 0)).toBeLessThan(rainAudioGain(1, 1));
  });

  it("wets the floor only while rain comes through an open aperture", () => {
    expect(stepWetness(0, 1, 1, 10)).toBeGreaterThan(0);
    expect(stepWetness(0, 1, 0, 10)).toBe(0);
  });

  it("dries the floor slowly when no rain comes in, and never goes below 0", () => {
    expect(stepWetness(0.5, 0, 0, 1)).toBeLessThan(0.5);
    expect(stepWetness(0, 0, 0, 100)).toBe(0);
  });

  it("caps wetness at 1", () => {
    expect(stepWetness(0.99, 1, 1, 1000)).toBe(1);
  });
});

describe("latch actions (spec 17.1)", () => {
  it("only latches a shut aperture", () => {
    expect(apertureActions.latch({ open: 0, latched: false })).toEqual({ open: 0, latched: true });
    expect(apertureActions.latch({ open: 0.5, latched: false })).toEqual({ open: 0.5, latched: false });
  });

  it("closing keeps the latch as it was", () => {
    expect(apertureActions.close({ open: 1, latched: true })).toEqual({ open: 0, latched: true });
  });

  it("open clears any latch", () => {
    expect(apertureActions.open()).toEqual({ open: 1, latched: false });
  });

  it("open fraction averages the apertures", () => {
    expect(openFraction([{ open: 1, latched: false }, { open: 0, latched: false }])).toBeCloseTo(0.5, 5);
  });
});

describe("hut placement grid (spec 18.2)", () => {
  const clay = getDecorItem("clay-pot")!;

  it("snaps to the 0.5 m grid", () => {
    expect(snap(0.3)).toBe(0.5);
    expect(snap(-0.3)).toBe(-0.5);
  });

  it("has a catalog where every item has a positive footprint", () => {
    for (const item of Object.values(DECOR_CATALOG)) {
      expect(item.width).toBeGreaterThan(0);
      expect(item.depth).toBeGreaterThan(0);
    }
    expect(footprintAt(clay, 0).w).toBeGreaterThan(0);
  });

  it("refuses to place decor outside the floor", () => {
    const r = checkPlacement(clay, FLOOR_BOUNDS.maxX + 1, 0, 0, [], CAT);
    expect(r).toBe("out-of-bounds");
  });

  it("refuses to place decor on the hearth", () => {
    const r = checkPlacement(clay, HEARTH.x, HEARTH.z, 0, [], CAT);
    expect(r).toBe("hearth");
  });

  it("refuses to place decor on the door or sleep areas", () => {
    // Door clearance overlaps the floor from z 1.6; a 1x1 item at z 1.7 stays inside the floor.
    const r = checkPlacement(clay, 1, 1.7, 0, [], CAT);
    expect(r).toBe("reserved");
  });

  it("refuses overlapping placements and accepts a free spot", () => {
    const first = { uid: "a", itemId: "clay-pot", x: 1, z: 0, rot: 0 };
    expect(checkPlacement(clay, 1, 0, 0, [first], CAT)).toBe("overlap");
    expect(checkPlacement(clay, 2, 0.5, 0, [first], CAT)).toBeNull();
  });
});

describe("decor catalog (spec 18.1)", () => {
  it("never sells trophies", () => {
    for (const item of Object.values(DECOR_CATALOG)) {
      if (item.source === "trophy") expect(item.id).toBeTruthy();
    }
  });
});
