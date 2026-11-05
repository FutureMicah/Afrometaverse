/**
 * Performance budgets — default path must stay playable on phone AND PC.
 * Outer world stream and dense fauna are opt-in (high tier only).
 */

import type { RenderTier } from "./renderTier";
import { currentRenderTier } from "./renderTier";

export type QualityBudget = {
  floraCount: number;
  worldDensity: number;
  animRadius: number;
  cullRadius: number;
  maxChunkLoads: number;
  shadows: boolean;
  characterDetail: boolean;
  expandedWorld: boolean;
  /** 12 km WorldChunk stream — heavy; only high */
  streamOuterWorld: boolean;
  forestCritters: boolean;
  villageAnimals: boolean;
  animalScale: number;
  maxNpcs: number;
  dprMax: number;
  dustMotes: number;
  fireflies: number;
};

const BUDGETS: Record<RenderTier, QualityBudget> = {
  low: {
    floraCount: 24,
    worldDensity: 0.15,
    animRadius: 12,
    cullRadius: 22,
    maxChunkLoads: 1,
    shadows: false,
    characterDetail: false,
    expandedWorld: false,
    streamOuterWorld: false,
    forestCritters: false,
    villageAnimals: false,
    animalScale: 0.25,
    maxNpcs: 10,
    dprMax: 1,
    dustMotes: 20,
    fireflies: 8,
  },
  mid: {
    floraCount: 60,
    worldDensity: 0.3,
    animRadius: 18,
    cullRadius: 32,
    maxChunkLoads: 1,
    shadows: false,
    characterDetail: false,
    expandedWorld: false,
    streamOuterWorld: false,
    forestCritters: false,
    villageAnimals: true,
    animalScale: 0.4,
    maxNpcs: 18,
    dprMax: 1,
    dustMotes: 40,
    fireflies: 14,
  },
  high: {
    floraCount: 100,
    worldDensity: 0.45,
    animRadius: 28,
    cullRadius: 48,
    maxChunkLoads: 1,
    shadows: true,
    characterDetail: true,
    expandedWorld: true,
    streamOuterWorld: true,
    forestCritters: true,
    villageAnimals: true,
    animalScale: 0.65,
    maxNpcs: 28,
    dprMax: 1.25,
    dustMotes: 60,
    fireflies: 24,
  },
};

/** Optional override: localStorage am-quality = low|mid|high */
export function qualityBudget(tier?: RenderTier): QualityBudget {
  let t = tier ?? currentRenderTier();
  if (typeof window !== "undefined") {
    try {
      const o = window.localStorage.getItem("am-quality");
      if (o === "low" || o === "mid" || o === "high") t = o;
    } catch {
      /* ignore */
    }
  }
  return BUDGETS[t];
}

let frame = 0;
export function nextFrameId(): number {
  frame = (frame + 1) | 0;
  return frame;
}

export function shouldUpdateSparse(phase: number, everyN = 2): boolean {
  return ((frame + ((phase * 10) | 0)) % everyN) === 0;
}
