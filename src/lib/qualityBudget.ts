/**
 * Quality budgets keyed by adaptive tier (FPS-driven).
 * Permanent approach: safe boot → measure → raise detail when the machine can hold it.
 */

import type { RenderTier } from "./renderTier";
import { useAdaptiveQuality } from "./adaptiveQuality";

export type QualityBudget = {
  floraCount: number;
  worldDensity: number;
  animRadius: number;
  cullRadius: number;
  maxChunkLoads: number;
  shadows: boolean;
  characterDetail: boolean;
  expandedWorld: boolean;
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
    floraCount: 28,
    worldDensity: 0.2,
    animRadius: 14,
    cullRadius: 24,
    maxChunkLoads: 1,
    shadows: false,
    characterDetail: false,
    expandedWorld: false,
    streamOuterWorld: false,
    forestCritters: false,
    villageAnimals: false,
    animalScale: 0.3,
    maxNpcs: 12,
    dprMax: 1,
    dustMotes: 18,
    fireflies: 8,
  },
  mid: {
    floraCount: 70,
    worldDensity: 0.35,
    animRadius: 22,
    cullRadius: 36,
    maxChunkLoads: 1,
    shadows: false,
    characterDetail: true,
    expandedWorld: true,
    streamOuterWorld: false, // still village-first; outer only on high
    forestCritters: false,
    villageAnimals: true,
    animalScale: 0.5,
    maxNpcs: 22,
    dprMax: 1,
    dustMotes: 36,
    fireflies: 16,
  },
  high: {
    floraCount: 120,
    worldDensity: 0.5,
    animRadius: 32,
    cullRadius: 55,
    maxChunkLoads: 1,
    shadows: true,
    characterDetail: true,
    expandedWorld: true,
    streamOuterWorld: true,
    forestCritters: true,
    villageAnimals: true,
    animalScale: 0.7,
    maxNpcs: 36,
    dprMax: 1.25,
    dustMotes: 55,
    fireflies: 22,
  },
};

/** Live budget from adaptive FPS controller (or locked localStorage tier). */
export function qualityBudget(override?: RenderTier): QualityBudget {
  if (override) return BUDGETS[override];
  const { tier, locked } = useAdaptiveQuality.getState();
  return BUDGETS[locked ?? tier];
}

export function qualityTier(): RenderTier {
  const { tier, locked } = useAdaptiveQuality.getState();
  return locked ?? tier;
}

let frame = 0;
export function nextFrameId(): number {
  frame = (frame + 1) | 0;
  return frame;
}

export function shouldUpdateSparse(phase: number, everyN = 2): boolean {
  return ((frame + ((phase * 10) | 0)) % everyN) === 0;
}
