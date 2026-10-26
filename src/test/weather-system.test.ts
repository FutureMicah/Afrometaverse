import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  WEATHER_TARGETS,
  VISUAL_WEATHER_IDS,
  nextHop,
  stepBlend,
  setBlendTo,
  visualFromSeasonal,
  advanceWindClock,
  emitWindGust,
  subscribeWindGust,
  windGustListenerCount,
  createGustClock,
  stepGustClock,
  windSwayAt,
  type WindGust,
} from "@/lib/weatherSystem";

describe("weather state machine routing", () => {
  it("stays put when already at the target", () => {
    for (const id of VISUAL_WEATHER_IDS) expect(nextHop(id, id)).toBe(id);
  });

  it("never skips a state: every hop is a graph neighbour", () => {
    // harmattan -> storm must pass through an intermediate state, never jump.
    const hop = nextHop("harmattan", "storm");
    expect(hop).not.toBe("storm");
    expect(VISUAL_WEATHER_IDS).toContain(hop);
  });

  it("reaches any target in a bounded number of hops", () => {
    for (const from of VISUAL_WEATHER_IDS) {
      for (const to of VISUAL_WEATHER_IDS) {
        let cur = from;
        let steps = 0;
        while (cur !== to && steps < 10) {
          cur = nextHop(cur, to);
          steps++;
        }
        expect(cur).toBe(to);
        expect(steps).toBeLessThanOrEqual(5);
      }
    }
  });

  it("maps seasonal weather onto visual states", () => {
    expect(visualFromSeasonal("dry")).toBeDefined();
    expect(VISUAL_WEATHER_IDS).toContain(visualFromSeasonal("rainy"));
    expect(VISUAL_WEATHER_IDS).toContain(visualFromSeasonal("harmattan"));
  });
});

describe("blend easing (no instant swaps)", () => {
  beforeEach(() => setBlendTo(WEATHER_TARGETS.clear as any, WEATHER_TARGETS.clear));

  it("moves toward the target gradually and settles", () => {
    const blend: any = { ...WEATHER_TARGETS.clear };
    const target = WEATHER_TARGETS.rain;
    const settledFirst = stepBlend(blend, target, 0.05);
    expect(settledFirst).toBe(false);
    expect(blend.rain).toBeGreaterThan(0);
    expect(blend.rain).toBeLessThan(target.rain);
    let settled = false;
    for (let i = 0; i < 2000 && !settled; i++) settled = stepBlend(blend, target, 0.05);
    expect(settled).toBe(true);
    expect(Math.abs(blend.rain - target.rain)).toBeLessThan(0.01);
  });
});

describe("wind clock and gust emitter", () => {
  it("wind clock is monotonic and ignores negative dt", () => {
    const seen: number[] = [];
    const un = subscribeWindGust((g) => seen.push(g.at));
    advanceWindClock(0.5);
    emitWindGust(0.4);
    advanceWindClock(-1);
    emitWindGust(0.6);
    un();
    expect(seen[1]!).toBeGreaterThanOrEqual(seen[0]!);
  });

  it("clamps strength to 0..1", () => {
    let last: WindGust | null = null;
    const un = subscribeWindGust((g) => (last = { ...g }));
    emitWindGust(7);
    expect(last!.strength).toBe(1);
    emitWindGust(-3);
    expect(last!.strength).toBe(0);
    un();
  });

  it("unsubscribe removes the listener", () => {
    const before = windGustListenerCount();
    const un = subscribeWindGust(() => {});
    expect(windGustListenerCount()).toBe(before + 1);
    un();
    expect(windGustListenerCount()).toBe(before);
  });

  it("gusts only fire in storms and cadence is bounded", () => {
    const clock = createGustClock();
    let fired = 0;
    for (let i = 0; i < 600; i++) if (stepGustClock(clock, 0.1, 0.1, () => 0.5) > 0) fired++;
    expect(fired).toBe(0);
    const storm = createGustClock();
    let stormFired = 0;
    for (let i = 0; i < 600; i++) if (stepGustClock(storm, 1, 0.1, () => 0.5) > 0) stormFired++;
    expect(stormFired).toBeGreaterThan(5);
    expect(stormFired).toBeLessThan(60); // at most one per 3 s of game time
  });

  it("gust strength is within 0..1", () => {
    const clock = createGustClock();
    for (let i = 0; i < 2000; i++) {
      const g = stepGustClock(clock, 1, 0.1, Math.random);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });
});

describe("vegetation sway", () => {
  it("is finite and bounded for any position and wind", () => {
    for (const wind of [0, 0.5, 1]) {
      for (let x = -30; x <= 30; x += 10) {
        const v = windSwayAt(x, 12, wind, 3.2);
        expect(Number.isFinite(v)).toBe(true);
        expect(Math.abs(v)).toBeLessThan(1);
      }
    }
  });
});
