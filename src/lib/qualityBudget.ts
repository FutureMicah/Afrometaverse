/**
 * Quality budgets + staged heavy flags (see adaptiveQuality heavyAllows).
 */

import type { RenderTier } from "./renderTier";
import { heavyAllows, useAdaptiveQuality } from "./adaptiveQuality";

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
    floraCount: 40,
    worldDensity: 0.25,
    animRadius: 16,
    cullRadius: 28,
    maxChunkLoads: 1,
    shadows: false,
    characterDetail: false,
    expandedWorld: false,
    streamOuterWorld: false,
    forestCritters: false,
    villageAnimals: true,
    animalScale: 0.55,
    maxNpcs: 14,
    dprMax: 1,
    dustMotes: 22,
    fireflies: 12,
  },
  mid: {
    floraCount: 90,
    worldDensity: 0.4,
    animRadius: 24,
    cullRadius: 40,
    maxChunkLoads: 1,
    shadows: false,
    characterDetail: true,
    expandedWorld: true,
    streamOuterWorld: false,
    forestCritters: true,
    villageAnimals: true,
    animalScale: 0.7,
    maxNpcs: 24,
    dprMax: 1,
    dustMotes: 40,
    fireflies: 18,
  },
  high: {
    floraCount: 110,
    worldDensity: 0.42,
    animRadius: 30,
    cullRadius: 50,
    maxChunkLoads: 1,
    shadows: true,
    characterDetail: true,
    expandedWorld: true,
    streamOuterWorld: true,
    forestCritters: true,
    villageAnimals: true,
    animalScale: 0.65,
    maxNpcs: 32,
    dprMax: 1.15,
    dustMotes: 48,
    fireflies: 20,
  },
};

/**
 * Live budget: base numbers from tier, heavy flags gated by STAGE
 * so high mode never dumps outer world + fauna + shadows in one frame.
 */
export function qualityBudget(override?: RenderTier): QualityBudget {
  const { tier, locked } = useAdaptiveQuality.getState();
  const t = override ?? locked ?? tier;
  const base = { ...BUDGETS[t] };

  // Stage gates override the static flags — but village life stays visible
  base.villageAnimals = true; // always show goats/chickens/etc near spawn
  base.expandedWorld = heavyAllows("expanded") || base.expandedWorld;
  base.forestCritters = heavyAllows("forest") || base.forestCritters;
  base.streamOuterWorld = heavyAllows("outer");
  base.shadows = heavyAllows("shadows");

  // Soften counts while still climbing stages (don't zero out environment)
  const stage = useAdaptiveQuality.getState().stage;
  if (stage === 0) {
    base.floraCount = Math.min(base.floraCount, 48);
    base.maxNpcs = Math.min(base.maxNpcs, 14);
    base.dustMotes = Math.min(base.dustMotes, 22);
    base.fireflies = Math.min(base.fireflies, 12);
  } else if (stage === 1) {
    base.floraCount = Math.round(base.floraCount * 0.85);
    base.maxNpcs = Math.round(base.maxNpcs * 0.85);
  }

  return base;
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
