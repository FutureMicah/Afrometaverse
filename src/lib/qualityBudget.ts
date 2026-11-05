/**
 * Performance budgets by render tier.
 * Keeps visual quality high near the player while preventing Lovable/mobile freezes.
 */

import type { RenderTier } from "./renderTier";
import { currentRenderTier } from "./renderTier";

export type QualityBudget = {
  /** BiomeFlora instance count in village */
  floraCount: number;
  /** Multiplier for WorldChunk props / animals / trees (0–1) */
  worldDensity: number;
  /** Max distance (m) to fully animate NPCs / creatures */
  animRadius: number;
  /** Beyond this, creatures skip useFrame updates */
  cullRadius: number;
  /** World chunk loads per streamer tick */
  maxChunkLoads: number;
  /** Shadow map — lower on weak devices */
  shadows: boolean;
  /** Detail flag for StylizedCharacter */
  characterDetail: boolean;
};

const BUDGETS: Record<RenderTier, QualityBudget> = {
  low: {
    floraCount: 80,
    worldDensity: 0.35,
    animRadius: 18,
    cullRadius: 42,
    maxChunkLoads: 1,
    shadows: false,
    characterDetail: false,
  },
  mid: {
    floraCount: 140,
    worldDensity: 0.55,
    animRadius: 28,
    cullRadius: 55,
    maxChunkLoads: 1,
    shadows: true,
    characterDetail: true,
  },
  high: {
    floraCount: 200,
    worldDensity: 0.75,
    animRadius: 40,
    cullRadius: 70,
    maxChunkLoads: 2,
    shadows: true,
    characterDetail: true,
  },
};

export function qualityBudget(tier?: RenderTier): QualityBudget {
  return BUDGETS[tier ?? currentRenderTier()];
}

/** Shared frame counter so many systems can throttle without desyncing badly. */
let frame = 0;
export function nextFrameId(): number {
  frame = (frame + 1) | 0;
  return frame;
}

export function shouldUpdateSparse(phase: number, everyN = 2): boolean {
  return ((frame + (phase * 10) | 0) % everyN) === 0;
}
