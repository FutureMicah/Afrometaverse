import { isInMeleeArc, knockDir } from "./damage";
import { PLAYER } from "./combatTypes";

export type EnemyState = "idle" | "aggro" | "chase" | "windup" | "strike" | "recover" | "flinch" | "dead";

export interface DummyEnemy {
  id: string;
  spawnX: number;
  spawnZ: number;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  state: EnemyState;
  stateMs: number;
  /** Ms of flinch/stagger left (stagger lasts longer and makes the next hit critical). */
  flinchMs: number;
  staggerMs: number;
  staggerMeter: number;
  respawnMs: number;
  kbX: number;
  kbZ: number;
}

/** Dummy stats. Stub enemy: one type, simple aggro, chase, attack loop. */
export const DUMMY = {
  maxHp: 100,
  radius: 0.4,
  aggroRange: 7,
  leashRange: 14,
  moveSpeed: 2.0,
  attackRange: 1.6,
  attackArc: 90,
  alertMs: 500,
  windupMs: 600,
  strikeMs: 120,
  recoverMs: 900,
  damage: 10,
  knockbackM: 0.6,
  flinchMs: 250,
  staggerMs: 1500,
  staggerAt: 100,
  respawnMs: 4000,
} as const;

export const DUMMY_STRIKE_BEGAN = 1;

export function createDummy(id: string, x: number, z: number): DummyEnemy {
  return {
    id,
    spawnX: x,
    spawnZ: z,
    x,
    z,
    yaw: Math.PI,
    hp: DUMMY.maxHp,
    maxHp: DUMMY.maxHp,
    state: "idle",
    stateMs: 0,
    flinchMs: 0,
    staggerMs: 0,
    staggerMeter: 0,
    respawnMs: 0,
    kbX: 0,
    kbZ: 0,
  };
}

export function respawnDummy(e: DummyEnemy): void {
  e.x = e.spawnX;
  e.z = e.spawnZ;
  e.hp = e.maxHp;
  e.state = "idle";
  e.stateMs = 0;
  e.flinchMs = 0;
  e.staggerMs = 0;
  e.staggerMeter = 0;
  e.respawnMs = 0;
  e.kbX = 0;
  e.kbZ = 0;
}

export function isStaggered(e: DummyEnemy): boolean {
  return e.staggerMs > 0;
}

/**
 * Apply a player hit. Adds stagger, flinches (or staggers at 100), knocks back, and dies at 0 HP.
 * A heavy into a stagger is always critical: the caller checks isStaggered before calling.
 */
export function enemyTakeHit(
  e: DummyEnemy,
  damage: number,
  staggerAmt: number,
  dirX: number,
  dirZ: number,
  knockbackM: number,
): { killed: boolean; staggered: boolean } {
  if (e.state === "dead") return { killed: false, staggered: false };
  e.hp = Math.max(0, e.hp - damage);
  e.staggerMeter += staggerAmt;
  e.kbX = dirX * knockbackM * PLAYER.knockbackDecay;
  e.kbZ = dirZ * knockbackM * PLAYER.knockbackDecay;
  if (e.hp <= 0) {
    e.state = "dead";
    e.stateMs = 0;
    e.respawnMs = DUMMY.respawnMs;
    e.flinchMs = 0;
    e.staggerMs = 0;
    return { killed: true, staggered: false };
  }
  if (e.staggerMeter >= DUMMY.staggerAt) {
    e.staggerMeter = 0;
    e.staggerMs = DUMMY.staggerMs;
    e.flinchMs = DUMMY.staggerMs;
    e.state = "flinch";
    e.stateMs = 0;
    return { killed: false, staggered: true };
  }
  e.flinchMs = DUMMY.flinchMs;
  e.state = "flinch";
  e.stateMs = 0;
  return { killed: false, staggered: false };
}

/**
 * Advance the enemy AI by dtMs. Returns DUMMY_STRIKE_BEGAN when its strike frame starts.
 * States: idle -> aggro (player inside aggroRange, alert delay) -> chase -> windup -> strike -> recover -> chase.
 * Leashes back to idle past leashRange. Flinch interrupts windup. Dead counts down to respawn.
 */
export function stepDummy(e: DummyEnemy, dtMs: number, px: number, pz: number): number {
  const sec = dtMs / 1000;
  if (e.state === "dead") {
    e.respawnMs -= dtMs;
    if (e.respawnMs <= 0) respawnDummy(e);
    return 0;
  }
  if (e.kbX !== 0 || e.kbZ !== 0) {
    e.x += e.kbX * sec;
    e.z += e.kbZ * sec;
    const decay = Math.exp(-PLAYER.knockbackDecay * sec);
    e.kbX *= decay;
    e.kbZ *= decay;
    if (Math.abs(e.kbX) < 0.01) e.kbX = 0;
    if (Math.abs(e.kbZ) < 0.01) e.kbZ = 0;
  }
  if (e.staggerMs > 0) e.staggerMs = Math.max(0, e.staggerMs - dtMs);
  e.stateMs += dtMs;

  const dx = px - e.x;
  const dz = pz - e.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 1e-6 && e.state !== "flinch" && e.state !== "strike") {
    e.yaw = Math.atan2(dx, dz);
  }

  switch (e.state) {
    case "idle":
      if (dist <= DUMMY.aggroRange) {
        e.state = "aggro";
        e.stateMs = 0;
      }
      break;
    case "aggro":
      if (dist > DUMMY.aggroRange) {
        e.state = "idle";
        e.stateMs = 0;
      } else if (e.stateMs >= DUMMY.alertMs) {
        e.state = "chase";
        e.stateMs = 0;
      }
      break;
    case "chase":
      if (dist > DUMMY.leashRange) {
        e.state = "idle";
        e.stateMs = 0;
      } else if (dist <= DUMMY.attackRange) {
        e.state = "windup";
        e.stateMs = 0;
      } else {
        const step = Math.min(dist, DUMMY.moveSpeed * sec);
        e.x += (dx / dist) * step;
        e.z += (dz / dist) * step;
      }
      break;
    case "windup":
      if (e.stateMs >= DUMMY.windupMs) {
        e.state = "strike";
        e.stateMs = 0;
        return DUMMY_STRIKE_BEGAN;
      }
      break;
    case "strike":
      if (e.stateMs >= DUMMY.strikeMs) {
        e.state = "recover";
        e.stateMs = 0;
      }
      break;
    case "recover":
      if (e.stateMs >= DUMMY.recoverMs) {
        e.state = dist <= DUMMY.leashRange ? "chase" : "idle";
        e.stateMs = 0;
      }
      break;
    case "flinch":
      if (e.stateMs >= e.flinchMs) {
        e.state = "chase";
        e.stateMs = 0;
      }
      break;
    default:
      break;
  }
  return 0;
}

/** True when the player stands inside the dummy's attack arc at its strike frame. */
export function dummyCanHit(e: DummyEnemy, px: number, pz: number): boolean {
  return isInMeleeArc(e.x, e.z, e.yaw, px, pz, DUMMY.attackRange, DUMMY.attackArc, 0.3);
}

export { knockDir };
