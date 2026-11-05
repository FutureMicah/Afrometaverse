/**
 * Permanent quality solution: start safe, measure real FPS, raise detail when stable.
 * Drops tier before the tab freezes. Optional localStorage lock: am-quality=low|mid|high
 */

import { create } from "zustand";
import type { RenderTier } from "./renderTier";
import { currentRenderTier } from "./renderTier";

type AdaptiveState = {
  /** Live tier used by qualityBudget */
  tier: RenderTier;
  fps: number;
  /** Device suggestion (hint only) */
  deviceTier: RenderTier;
  /** User forced lock from localStorage */
  locked: RenderTier | null;
  setTier: (t: RenderTier) => void;
  setFps: (fps: number) => void;
  init: () => void;
};

function readLock(): RenderTier | null {
  if (typeof window === "undefined") return null;
  try {
    const o = window.localStorage.getItem("am-quality");
    if (o === "low" || o === "mid" || o === "high") return o;
  } catch {
    /* ignore */
  }
  return null;
}

export const useAdaptiveQuality = create<AdaptiveState>((set, get) => ({
  tier: "low",
  fps: 60,
  deviceTier: "low",
  locked: null,
  setTier: (tier) => set({ tier }),
  setFps: (fps) => set({ fps }),
  init: () => {
    const deviceTier = currentRenderTier();
    const locked = readLock();
    set({
      deviceTier,
      locked,
      // Always boot low unless user locked mid/high — then still start low for 1s safety
      tier: "low",
    });
    // After first paint, if locked, apply lock
    if (locked) {
      setTimeout(() => {
        if (get().locked) set({ tier: get().locked! });
      }, 1500);
    }
  },
}));

const ORDER: RenderTier[] = ["low", "mid", "high"];

function stepUp(t: RenderTier): RenderTier {
  return ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(t) + 1)]!;
}
function stepDown(t: RenderTier): RenderTier {
  return ORDER[Math.max(0, ORDER.indexOf(t) - 1)]!;
}

/**
 * Call once per frame from inside the Canvas.
 * Raises quality when FPS is healthy; cuts quality when FPS tanks.
 */
export function adaptiveQualityTick(dt: number) {
  const state = useAdaptiveQuality.getState();
  if (state.locked) return; // user override — still track fps only
  const fps = dt > 0 ? 1 / dt : 60;
  // EMA smooth
  const smooth = state.fps * 0.9 + fps * 0.1;
  useAdaptiveQuality.setState({ fps: smooth });

  // Sample window via module counters
  tickBudget(smooth);
}

let goodFrames = 0;
let badFrames = 0;
let lastChange = 0;

function tickBudget(fps: number) {
  const now = performance.now();
  if (now - lastChange < 2500) return; // cooldown between tier changes

  const { tier, locked } = useAdaptiveQuality.getState();
  if (locked) return;

  if (fps < 26) {
    badFrames += 1;
    goodFrames = 0;
    if (badFrames >= 8 && tier !== "low") {
      useAdaptiveQuality.setState({ tier: stepDown(tier) });
      lastChange = now;
      badFrames = 0;
    }
    return;
  }

  badFrames = 0;
  if (fps >= 42) {
    goodFrames += 1;
    if (goodFrames >= 90) {
      // ~1.5s at 60fps of good frames
      const deviceCap = useAdaptiveQuality.getState().deviceTier;
      const next = stepUp(tier);
      // Don't exceed device hint by more than one step unless fps is excellent
      const capIdx = ORDER.indexOf(deviceCap === "low" ? "mid" : deviceCap);
      const nextIdx = ORDER.indexOf(next);
      if (nextIdx <= Math.max(capIdx, ORDER.indexOf(tier)) + (fps >= 52 ? 1 : 0) && next !== tier) {
        // Allow up to high only if fps is very strong
        if (next === "high" && fps < 50) {
          goodFrames = 0;
          return;
        }
        useAdaptiveQuality.setState({ tier: next });
        lastChange = now;
      }
      goodFrames = 0;
    }
  } else {
    goodFrames = Math.max(0, goodFrames - 2);
  }
}
