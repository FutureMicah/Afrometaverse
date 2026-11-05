/**
 * Performance budgets by render tier — tuned to stop Lovable preview freezes.
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
  /** Mount ExpandedWorld ring of outer biomes */
  expandedWorld: boolean;
  /** Mount ForestCritters (many useFrame animals) */
  forestCritters: boolean;
  /** Fraction of village animal list to spawn 0–1 */
  animalScale: number;
  /** Cap on animated NPCs in NpcCrowd */
  maxNpcs: number;
  /** Pixel ratio cap */
  dprMax: number;
};

const BUDGETS: Record<RenderTier, QualityBudget> = {
  low: {
    floraCount: 40,
    worldDensity: 0.2,
    animRadius: 14,
    cullRadius: 28,
    maxChunkLoads: 1,
    shadows: false,
    characterDetail: false,
    expandedWorld: false,
    forestCritters: false,
    animalScale: 0.35,
    maxNpcs: 16,
    dprMax: 1,
  },
  mid: {
    floraCount: 90,
    worldDensity: 0.4,
    animRadius: 22,
    cullRadius: 40,
    maxChunkLoads: 1,
    shadows: false,
    characterDetail: false,
    expandedWorld: true,
    forestCritters: false,
    animalScale: 0.55,
    maxNpcs: 28,
    dprMax: 1,
  },
  high: {
    floraCount: 140,
    worldDensity: 0.55,
    animRadius: 32,
    cullRadius: 55,
    maxChunkLoads: 1,
    shadows: true,
    characterDetail: true,
    expandedWorld: true,
    forestCritters: true,
    animalScale: 0.75,
    maxNpcs: 40,
    dprMax: 1.25,
  },
};

export function qualityBudget(tier?: RenderTier): QualityBudget {
  return BUDGETS[tier ?? currentRenderTier()];
}

let frame = 0;
export function nextFrameId(): number {
  frame = (frame + 1) | 0;
  return frame;
}

export function shouldUpdateSparse(phase: number, everyN = 2): boolean {
  return ((frame + ((phase * 10) | 0)) % everyN) === 0;
}
