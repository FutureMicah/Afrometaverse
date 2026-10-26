// Weapon stats table. Melee: iron machete, hunting spear, fists (club and staff are in spec but not in the slot table yet).
// Bow is a ranged stub with charge levels only. Numbers are tuning placeholders, not final balance.
// Period detail follows the spec: the machete is a forged iron blade (Ogun forge), the spear is a hunting spear
// with an iron or obsidian head, the bow is a self-bow with a charge hold.

export type WeaponId = "machete" | "spear" | "bow" | "fists";
export type WeaponSlot = 1 | 2 | 3 | 4;

export interface AttackTiming {
  windupMs: number;
  strikeMs: number;
  recoverMs: number;
}

export interface WeaponStats {
  id: WeaponId;
  name: string;
  slot: WeaponSlot;
  melee: boolean;
  /** Base damage of a heavy hit. */
  heavyDamage: number;
  /** Base damage per light chain hit (spec: 35 to 45 percent of the heavy). */
  lightDamage: number;
  /** Hits in one light chain (spec: 2 to 4). */
  lightChain: number;
  light: AttackTiming;
  heavy: AttackTiming;
  /** Reach in metres for light attacks. */
  reachM: number;
  /** Reach in metres for heavy attacks (spear lunge reaches further). */
  heavyReachM: number;
  /** Full arc in degrees in front of the attacker. */
  arcDeg: number;
  /** How many targets one strike can hit (machete cleave hits two). */
  maxTargets: number;
  /** Damage reduction while blocking, 0 to 1. */
  blockPct: number;
  /** Parry window in ms before and after the enemy hit frame (staff is wider). */
  parryWindowMs: number;
  staggerLight: number;
  staggerHeavy: number;
  knockbackM: number;
  /** Ranged weapons only. */
  rangeM?: number;
}

export const LIGHT_FINISHER_MULT = 1.3;

export const WEAPONS: Record<WeaponId, WeaponStats> = {
  machete: {
    id: "machete",
    name: "Iron machete",
    slot: 1,
    melee: true,
    heavyDamage: 34,
    lightDamage: 14,
    lightChain: 3,
    light: { windupMs: 150, strikeMs: 100, recoverMs: 150 },
    heavy: { windupMs: 900, strikeMs: 120, recoverMs: 550 },
    reachM: 1.6,
    heavyReachM: 1.8,
    arcDeg: 120,
    maxTargets: 2,
    blockPct: 0.4,
    parryWindowMs: 150,
    staggerLight: 10,
    staggerHeavy: 35,
    knockbackM: 0.6,
  },
  spear: {
    id: "spear",
    name: "Hunting spear",
    slot: 2,
    melee: true,
    heavyDamage: 40,
    lightDamage: 15,
    lightChain: 2,
    light: { windupMs: 180, strikeMs: 80, recoverMs: 200 },
    heavy: { windupMs: 1200, strikeMs: 110, recoverMs: 600 },
    reachM: 2.2,
    heavyReachM: 3.0,
    arcDeg: 30,
    maxTargets: 1,
    blockPct: 0.35,
    parryWindowMs: 150,
    staggerLight: 10,
    staggerHeavy: 40,
    knockbackM: 0.8,
  },
  bow: {
    id: "bow",
    name: "Self-bow (stub)",
    slot: 3,
    melee: false,
    heavyDamage: 30,
    lightDamage: 0,
    lightChain: 0,
    light: { windupMs: 0, strikeMs: 0, recoverMs: 0 },
    heavy: { windupMs: 0, strikeMs: 0, recoverMs: 0 },
    reachM: 0,
    heavyReachM: 0,
    arcDeg: 0,
    maxTargets: 1,
    blockPct: 0,
    parryWindowMs: 0,
    staggerLight: 0,
    staggerHeavy: 30,
    knockbackM: 0,
    rangeM: 20,
  },
  fists: {
    id: "fists",
    name: "Bare fists",
    slot: 4,
    melee: true,
    heavyDamage: 8,
    lightDamage: 4,
    lightChain: 2,
    light: { windupMs: 90, strikeMs: 70, recoverMs: 200 },
    heavy: { windupMs: 350, strikeMs: 90, recoverMs: 420 },
    reachM: 1.1,
    heavyReachM: 1.2,
    arcDeg: 90,
    maxTargets: 1,
    blockPct: 0.2,
    parryWindowMs: 150,
    staggerLight: 10,
    staggerHeavy: 20,
    knockbackM: 0.3,
  },
};

export const WEAPON_BY_SLOT: Record<WeaponSlot, WeaponId> = {
  1: "machete",
  2: "spear",
  3: "bow",
  4: "fists",
};

/** Bow charge levels (spec 8.6): tap = fast shot, then 0.4 s, 1.2 s and 2.0 s holds. */
export const BOW_CHARGE_LEVELS: { holdMs: number; mult: number; pin: boolean }[] = [
  { holdMs: 0, mult: 0.35, pin: false },
  { holdMs: 400, mult: 0.6, pin: false },
  { holdMs: 1200, mult: 1, pin: true },
  { holdMs: 2000, mult: 1, pin: true },
];

export function bowShotDamage(chargeMs: number, w: WeaponStats = WEAPONS.bow): number {
  let mult = BOW_CHARGE_LEVELS[0]?.mult ?? 0.35;
  for (const level of BOW_CHARGE_LEVELS) {
    if (chargeMs >= level.holdMs) mult = level.mult;
  }
  return Math.round(w.heavyDamage * mult);
}
