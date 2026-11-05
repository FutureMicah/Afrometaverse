/**
 * Adaptive quality — permanent solution for heavy mode:
 * 1) Always boot low (stable)
 * 2) Raise tier when FPS is healthy
 * 3) Heavy features unlock in STAGES, not all at once
 * 4) Outer world only when player leaves the village AND FPS holds
 * 5) Auto step-down if FPS tanks
 *
 * Override: localStorage.setItem("am-quality","low"|"mid"|"high")
 */

import { create } from "zustand";
import type { RenderTier } from "./renderTier";
import { currentRenderTier } from "./renderTier";

/** Staged heavy features inside a tier */
export type HeavyStage = 0 | 1 | 2 | 3;
// 0 = core village only
// 1 = + village animals / more NPCs
// 2 = + expanded biomes / particles
// 3 = + outer world stream (only if far from village + FPS ok)

type AdaptiveState = {
  tier: RenderTier;
  stage: HeavyStage;
  fps: number;
  deviceTier: RenderTier;
  locked: RenderTier | null;
  /** Player distance from village origin — set each frame from scene */
  playerRadius: number;
  setTier: (t: RenderTier) => void;
  setStage: (s: HeavyStage) => void;
  setFps: (fps: number) => void;
  setPlayerRadius: (r: number) => void;
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
  stage: 0,
  fps: 60,
  deviceTier: "low",
  locked: null,
  playerRadius: 0,
  setTier: (tier) => set({ tier }),
  setStage: (stage) => set({ stage }),
  setFps: (fps) => set({ fps }),
  setPlayerRadius: (playerRadius) => set({ playerRadius }),
  init: () => {
    const deviceTier = currentRenderTier();
    const locked = readLock();
    set({ deviceTier, locked, tier: "low", stage: 0 });
    // Locked high still boots low, then stages in after settle
    if (locked) {
      window.setTimeout(() => {
        if (!get().locked) return;
        set({ tier: get().locked!, stage: 0 });
      }, 1200);
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

let goodFrames = 0;
let badFrames = 0;
let lastChange = 0;
let stageGood = 0;

/**
 * Call once per frame from inside the Canvas.
 */
export function adaptiveQualityTick(dt: number) {
  const fps = dt > 0 ? Math.min(120, 1 / dt) : 60;
  const state = useAdaptiveQuality.getState();
  const smooth = state.fps * 0.88 + fps * 0.12;
  useAdaptiveQuality.setState({ fps: smooth });

  const now = performance.now();
  const locked = state.locked;

  // --- emergency drop ---
  if (smooth < 24) {
    badFrames += 1;
    goodFrames = 0;
    stageGood = 0;
    if (badFrames >= 6 && now - lastChange > 1500) {
      if (state.stage > 0) {
        useAdaptiveQuality.setState({ stage: (state.stage - 1) as HeavyStage });
        lastChange = now;
      } else if (!locked && state.tier !== "low") {
        useAdaptiveQuality.setState({ tier: stepDown(state.tier), stage: 0 });
        lastChange = now;
      }
      badFrames = 0;
    }
    return;
  }
  badFrames = 0;

  if (now - lastChange < 2200) return;

  // --- stage progression inside current tier (heavy mode done right) ---
  if (smooth >= 40) {
    stageGood += 1;
  } else {
    stageGood = Math.max(0, stageGood - 3);
  }

  const maxStage: HeavyStage =
    (locked ?? state.tier) === "high" ? 3 : (locked ?? state.tier) === "mid" ? 2 : 1;

  if (stageGood >= 70 && state.stage < maxStage) {
    // Outer world (stage 3) only if player left the village core
    if (state.stage === 2 && state.playerRadius < 85) {
      stageGood = 40; // wait until they explore outward
      return;
    }
    if (state.stage === 2 && smooth < 45) {
      stageGood = 30;
      return;
    }
    useAdaptiveQuality.setState({ stage: (state.stage + 1) as HeavyStage });
    lastChange = now;
    stageGood = 0;
    return;
  }

  // --- tier up (only if not locked) ---
  if (locked) return;
  if (smooth >= 44) {
    goodFrames += 1;
    if (goodFrames >= 100) {
      const next = stepUp(state.tier);
      if (next !== state.tier) {
        // high requires strong FPS
        if (next === "high" && smooth < 50) {
          goodFrames = 0;
          return;
        }
        useAdaptiveQuality.setState({ tier: next, stage: 0 });
        lastChange = now;
      }
      goodFrames = 0;
    }
  } else {
    goodFrames = Math.max(0, goodFrames - 2);
  }
}

/** Whether a heavy feature is allowed for the current tier+stage */
export function heavyAllows(feature: "animals" | "expanded" | "forest" | "outer" | "shadows"): boolean {
  const { tier, stage, locked } = useAdaptiveQuality.getState();
  const t = locked ?? tier;
  if (feature === "animals") return t !== "low" && stage >= 1;
  if (feature === "expanded") return (t === "mid" || t === "high") && stage >= 2;
  if (feature === "forest") return t === "high" && stage >= 2;
  if (feature === "outer") return t === "high" && stage >= 3;
  if (feature === "shadows") return t === "high" && stage >= 2;
  return false;
}
