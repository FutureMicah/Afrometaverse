import { LIGHT_FINISHER_MULT, type WeaponStats } from "./weapons";
import { PARRY } from "./combatTypes";

export interface DamageInput {
  base: number;
  blocking: boolean;
  blockPct: number;
  critical: boolean;
  zoneMult?: number;
}

export interface DamageResult {
  damage: number;
  blocked: boolean;
  critical: boolean;
}

/** Critical hits (stagger, parry counter, clean angle) add 50 percent. */
export const CRIT_MULT = 1.5;

/** Deterministic damage: base x zone x crit, then block reduction. Rounded to whole points. */
export function computeDamage(input: DamageInput): DamageResult {
  let d = input.base * (input.zoneMult ?? 1);
  if (input.critical) d *= CRIT_MULT;
  const pct = Math.min(1, Math.max(0, input.blockPct));
  if (input.blocking) d *= 1 - pct;
  return { damage: Math.max(0, Math.round(d)), blocked: input.blocking, critical: input.critical };
}

/** Base damage for one melee strike. Light chain finisher (last hit) gets a bonus. */
export function meleeBaseDamage(w: WeaponStats, kind: "light" | "heavy", chainIndex: number): number {
  if (kind === "heavy") return w.heavyDamage;
  const finisher = chainIndex === w.lightChain - 1;
  return Math.round(w.lightDamage * (finisher ? LIGHT_FINISHER_MULT : 1));
}

/**
 * Distance plus angle hit test on the ground plane (x and z).
 * Facing is yaw in radians with the same convention as the movement code: forward = (sin yaw, cos yaw).
 * targetRadius widens the reach so a target's body edge counts, not just its centre.
 */
export function isInMeleeArc(
  ax: number,
  az: number,
  yaw: number,
  tx: number,
  tz: number,
  reachM: number,
  arcDeg: number,
  targetRadius = 0.4,
): boolean {
  const dx = tx - ax;
  const dz = tz - az;
  const dist = Math.hypot(dx, dz);
  if (dist > reachM + targetRadius) return false;
  if (dist < 1e-6) return true;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const cos = (dx * fx + dz * fz) / dist;
  const halfArc = (arcDeg * Math.PI) / 360;
  return Math.acos(Math.min(1, Math.max(-1, cos))) <= halfArc;
}

export type ParryGrade = "none" | "parry" | "perfect";

/**
 * diffMs = hitFrameMs - blockPressMs. A press up to 150 ms before the hit frame is a parry,
 * up to 50 ms after it is still a parry (window runs -50..windowMs). Perfect is a 80 ms
 * window centred 50 ms before the hit frame.
 */
export function parryGrade(diffMs: number, windowMs: number): ParryGrade {
  if (diffMs < -PARRY.LATE_MS || diffMs > windowMs) return "none";
  if (Math.abs(diffMs - PARRY.PERFECT_CENTRE_MS) <= PARRY.PERFECT_HALF_MS) return "perfect";
  return "parry";
}

/** Knockback direction from a point to another, normalised. Writes into out to avoid allocation. */
export function knockDir(fromX: number, fromZ: number, toX: number, toZ: number, out: { x: number; z: number }) {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) {
    out.x = 0;
    out.z = 1;
  } else {
    out.x = dx / len;
    out.z = dz / len;
  }
  return out;
}
