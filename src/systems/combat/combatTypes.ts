// Shared combat constants. All timings are milliseconds on a fixed 60 Hz step.
// Values follow era-progression-spec.md section 8.2 to 8.4 unless marked as a stub.

export type AttackPhase = "idle" | "windup" | "strike" | "recover" | "block" | "dodge" | "hit";

export const TIMING = {
  /** A light can follow a light within this window after the previous chain hit. */
  LIGHT_CHAIN_WINDOW_MS: 350,
  /** Holding attack this long charges a heavy (charge input is stubbed, see inputMap). */
  HEAVY_CHARGE_MS: 450,
  DODGE_TOTAL_MS: 450,
  /** I-frames run from 60 ms to 220 ms into the roll (spec 8.2, 160 ms wide). */
  DODGE_IFRAME_START_MS: 60,
  DODGE_IFRAME_END_MS: 220,
  /** A dodge may cancel a light or heavy recovery after this many ms. */
  DODGE_CANCEL_AFTER_MS: 200,
  /** A missed parry is a block with this recovery. */
  MISSED_PARRY_RECOVER_MS: 400,
  /** A block tap this recent that lands outside the parry window counts as a missed parry. */
  MISSED_PARRY_TAP_MS: 400,
  /** Winded state after stamina hits zero. */
  WINDED_MS: 2000,
  HIT_STUN_MS: 300,
  /** Counter window after a successful parry: a light attack lands as a critical. */
  COUNTER_WINDOW_MS: 400,
} as const;

export const STAMINA = {
  max: 100,
  regenIdle: 18,
  regenWalk: 8,
  regenBlock: 0,
  costLight: 8,
  costHeavy: 22,
  costParry: 12,
  costFailedParry: 20,
  costDodge: 16,
  costBlockHit: 6,
  /** Damage-based chip cost per point of raw incoming damage on a block. */
  chipPerDamage: 0.5,
  /** Blocking while winded or at zero costs double. */
  windedBlockMult: 2,
} as const;

export const PLAYER = {
  maxHealth: 100,
  /** Walking speed in metres per second (stub, tuned for a 16 m arena). */
  speed: 3.2,
  dodgeSpeed: 6,
  respawnMs: 3000,
  /** Knockback decay rate (per second) used for both player and enemies. */
  knockbackDecay: 8,
} as const;

/** Arena half-size in metres: the arena runs from -ARENA_HALF to +ARENA_HALF on both axes. */
export const ARENA_HALF = 8;

export const PARRY = {
  /** Parry window opens 150 ms before the hit frame ... */
  EARLY_MS: 150,
  /** ... and closes 50 ms after it (the grace is not wired yet, see report). */
  LATE_MS: 50,
  /** Perfect parry: 80 ms window centred 50 ms before the hit frame (diff 10..90). */
  PERFECT_CENTRE_MS: 50,
  PERFECT_HALF_MS: 40,
} as const;
