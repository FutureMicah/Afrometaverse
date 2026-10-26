import { PARRY, PLAYER, STAMINA, TIMING, ARENA_HALF, type AttackPhase } from "./combatTypes";
import { parryGrade } from "./damage";
import { WEAPONS, type AttackTiming, type WeaponStats } from "./weapons";

export type AttackKind = "light" | "heavy";
export type ActionResult = "started" | "busy" | "winded" | "noStamina" | "dead" | "unsupported";
export type HitKind = "dead" | "dodged" | "parried" | "perfectParry" | "missedParry" | "blocked" | "hit";

export const FLAG_STRIKE_BEGAN = 1;

export interface PlayerCombat {
  x: number;
  z: number;
  /** Facing in radians, forward = (sin yaw, cos yaw). */
  yaw: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  /** Ms left of the winded state (no attack, no dodge). */
  winded: number;
  phase: AttackPhase;
  phaseMs: number;
  phaseDurMs: number;
  attack: AttackKind | null;
  /** Light chain hit index of the strike that is currently being thrown. */
  strikeIndex: number;
  /** Light hits already landed in the current chain. */
  chainIndex: number;
  /** Ms since the last chain hit recovered (chain resets after LIGHT_CHAIN_WINDOW_MS). */
  chainTimerMs: number;
  strikeFired: boolean;
  dodgeDx: number;
  dodgeDz: number;
  blockHeld: boolean;
  /** Clock time (ms) of the last block press; -Infinity when none. */
  blockPressAt: number;
  moveX: number;
  moveZ: number;
  moving: boolean;
  kbX: number;
  kbZ: number;
  /** Counter window after a parry; a hit inside it is a critical. */
  counterMs: number;
  dead: boolean;
  respawnMs: number;
}

export function createPlayer(x = 0, z = 0): PlayerCombat {
  return {
    x,
    z,
    yaw: 0,
    health: PLAYER.maxHealth,
    maxHealth: PLAYER.maxHealth,
    stamina: STAMINA.max,
    maxStamina: STAMINA.max,
    winded: 0,
    phase: "idle",
    phaseMs: 0,
    phaseDurMs: 0,
    attack: null,
    strikeIndex: 0,
    chainIndex: 0,
    chainTimerMs: 0,
    strikeFired: false,
    dodgeDx: 0,
    dodgeDz: 0,
    blockHeld: false,
    blockPressAt: -Infinity,
    moveX: 0,
    moveZ: 0,
    moving: false,
    kbX: 0,
    kbZ: 0,
    counterMs: 0,
    dead: false,
    respawnMs: 0,
  };
}

export function timingFor(w: WeaponStats, kind: AttackKind): AttackTiming {
  return kind === "heavy" ? w.heavy : w.light;
}

/** Spend stamina. Reaching zero starts the winded state (spec 8.2). Never goes negative. */
export function drain(p: PlayerCombat, amount: number): void {
  p.stamina = Math.max(0, p.stamina - amount);
  if (p.stamina === 0 && p.winded === 0) p.winded = TIMING.WINDED_MS;
}

export function startAttack(p: PlayerCombat, kind: AttackKind, w: WeaponStats): ActionResult {
  if (p.dead) return "dead";
  if (!w.melee) return "unsupported";
  if (p.winded > 0) return "winded";
  if (p.phase === "recover") {
    // Only a light chain can cancel into the next light during recovery.
    if (kind !== "light" || p.attack !== "light" || p.chainIndex >= w.lightChain) return "busy";
  } else if (p.phase !== "idle") {
    return "busy";
  }
  const cost = kind === "heavy" ? STAMINA.costHeavy : STAMINA.costLight;
  if (p.stamina < cost) return "noStamina";

  if (kind === "light") {
    if (p.phase === "idle" && p.chainTimerMs > TIMING.LIGHT_CHAIN_WINDOW_MS) p.chainIndex = 0;
    if (p.chainIndex >= w.lightChain) p.chainIndex = 0;
  }
  const hitIndex = kind === "light" ? p.chainIndex : 0;
  p.strikeIndex = hitIndex;
  p.chainIndex = kind === "light" ? p.chainIndex + 1 : 0;
  drain(p, cost);

  p.attack = kind;
  p.phase = "windup";
  p.phaseMs = 0;
  p.phaseDurMs = timingFor(w, kind).windupMs;
  p.strikeFired = false;
  return "started";
}

/** Block press or release. Blocking starts only from idle; a press time is kept for parry grading. */
export function setBlock(p: PlayerCombat, held: boolean, nowMs: number): void {
  if (p.dead) return;
  if (held && !p.blockHeld) p.blockPressAt = nowMs;
  p.blockHeld = held;
  if (held && p.phase === "idle") {
    p.phase = "block";
    p.phaseMs = 0;
    p.phaseDurMs = Infinity;
  } else if (!held && p.phase === "block") {
    p.phase = "idle";
    p.phaseMs = 0;
    p.phaseDurMs = 0;
  }
}

export function startDodge(p: PlayerCombat): ActionResult {
  if (p.dead) return "dead";
  if (p.winded > 0) return "winded";
  if (p.phase === "windup") {
    // A heavy's wind-up can be cancelled by a roll (spec 8.4). A light's cannot.
    if (p.attack !== "heavy") return "busy";
  } else if (p.phase === "recover") {
    if (p.phaseMs < TIMING.DODGE_CANCEL_AFTER_MS) return "busy";
  } else if (p.phase !== "idle" && p.phase !== "block") {
    return "busy";
  }
  if (p.stamina < STAMINA.costDodge) return "noStamina";
  drain(p, STAMINA.costDodge);

  let dx = p.moveX;
  let dz = p.moveZ;
  if (dx === 0 && dz === 0) {
    dx = -Math.sin(p.yaw);
    dz = -Math.cos(p.yaw);
  } else {
    const len = Math.hypot(dx, dz);
    dx /= len;
    dz /= len;
  }
  p.dodgeDx = dx;
  p.dodgeDz = dz;
  p.phase = "dodge";
  p.phaseMs = 0;
  p.phaseDurMs = TIMING.DODGE_TOTAL_MS;
  p.attack = null;
  p.chainIndex = 0;
  p.strikeFired = false;
  return "started";
}

export function setMove(p: PlayerCombat, x: number, z: number): void {
  const len = Math.hypot(x, z);
  if (len > 1) {
    p.moveX = x / len;
    p.moveZ = z / len;
  } else {
    p.moveX = x;
    p.moveZ = z;
  }
}

/** Advance the player by dtMs. Returns FLAG_STRIKE_BEGAN when a strike frame starts this step. */
export function tickPlayer(p: PlayerCombat, dtMs: number, w: WeaponStats): number {
  if (p.dead) return 0;
  let flags = 0;
  const sec = dtMs / 1000;

  if (p.counterMs > 0) p.counterMs = Math.max(0, p.counterMs - dtMs);
  if (p.winded > 0) {
    p.winded = Math.max(0, p.winded - dtMs);
  } else if (p.phase === "idle") {
    const rate = p.moving ? STAMINA.regenWalk : STAMINA.regenIdle;
    p.stamina = Math.min(p.maxStamina, p.stamina + rate * sec);
  } else if (p.phase === "block") {
    // Blocking regenerates nothing (spec: 0 while blocking).
  }

  p.phaseMs += dtMs;
  switch (p.phase) {
    case "idle":
      p.chainTimerMs += dtMs;
      break;
    case "windup":
      if (p.phaseMs >= p.phaseDurMs) {
        const t = timingFor(w, p.attack ?? "light");
        p.phase = "strike";
        p.phaseMs = 0;
        p.phaseDurMs = t.strikeMs;
        p.strikeFired = true;
        flags |= FLAG_STRIKE_BEGAN;
      }
      break;
    case "strike":
      if (p.phaseMs >= p.phaseDurMs) {
        const t = timingFor(w, p.attack ?? "light");
        p.phase = "recover";
        p.phaseMs = 0;
        p.phaseDurMs = t.recoverMs;
        p.chainTimerMs = 0;
      }
      break;
    case "recover":
      if (p.phaseMs >= p.phaseDurMs) {
        p.phase = "idle";
        p.phaseMs = 0;
        p.attack = null;
        p.chainTimerMs = 0;
      }
      break;
    case "hit":
      if (p.phaseMs >= p.phaseDurMs) {
        p.phase = "idle";
        p.phaseMs = 0;
      }
      break;
    case "dodge":
      if (p.phaseMs >= p.phaseDurMs) {
        p.phase = p.blockHeld ? "block" : "idle";
        p.phaseMs = 0;
        p.phaseDurMs = p.blockHeld ? Infinity : 0;
      }
      break;
    default:
      break;
  }

  // Movement: idle walks, block walks at half speed, dodge rolls at dodge speed.
  p.moving = false;
  if (p.phase === "dodge") {
    p.x += p.dodgeDx * PLAYER.dodgeSpeed * sec;
    p.z += p.dodgeDz * PLAYER.dodgeSpeed * sec;
  } else if (p.phase === "idle" || p.phase === "block") {
    if (p.moveX !== 0 || p.moveZ !== 0) {
      p.moving = p.phase === "idle";
      const mul = p.phase === "block" ? 0.5 : 1;
      p.x += p.moveX * PLAYER.speed * mul * sec;
      p.z += p.moveZ * PLAYER.speed * mul * sec;
      p.yaw = Math.atan2(p.moveX, p.moveZ);
    }
  }

  if (p.kbX !== 0 || p.kbZ !== 0) {
    p.x += p.kbX * sec;
    p.z += p.kbZ * sec;
    const decay = Math.exp(-PLAYER.knockbackDecay * sec);
    p.kbX *= decay;
    p.kbZ *= decay;
    if (Math.abs(p.kbX) < 0.01) p.kbX = 0;
    if (Math.abs(p.kbZ) < 0.01) p.kbZ = 0;
  }

  p.x = Math.min(ARENA_HALF, Math.max(-ARENA_HALF, p.x));
  p.z = Math.min(ARENA_HALF, Math.max(-ARENA_HALF, p.z));
  return flags;
}

/**
 * Resolve an incoming hit at hitAtMs (the enemy strike frame, on the same clock as blockPressAt).
 * Order: dodge i-frames, parry (press inside the window), block, then a clean hit (flinch + knockback).
 */
export function takeHit(
  p: PlayerCombat,
  raw: number,
  hitAtMs: number,
  w: WeaponStats,
  fromX: number,
  fromZ: number,
  knockbackM: number,
): { kind: HitKind; damage: number } {
  if (p.dead) return { kind: "dead", damage: 0 };
  if (
    p.phase === "dodge" &&
    p.phaseMs >= TIMING.DODGE_IFRAME_START_MS &&
    p.phaseMs <= TIMING.DODGE_IFRAME_END_MS
  ) {
    return { kind: "dodged", damage: 0 };
  }

  const pressed = Number.isFinite(p.blockPressAt);
  const diff = pressed ? hitAtMs - p.blockPressAt : 0;
  const grade = pressed ? parryGrade(diff, w.parryWindowMs) : "none";
  if (grade !== "none" && p.winded === 0) {
    p.blockPressAt = -Infinity;
    p.counterMs = TIMING.COUNTER_WINDOW_MS;
    drain(p, STAMINA.costParry);
    return { kind: grade === "perfect" ? "perfectParry" : "parried", damage: 0 };
  }

  // Tapped block outside the window: a missed parry is a block with recovery and a stamina penalty.
  const missed = pressed && grade === "none" && diff > 0 && diff <= TIMING.MISSED_PARRY_TAP_MS && p.winded === 0;
  if (missed) {
    drain(p, STAMINA.costFailedParry);
    p.attack = null;
    p.phase = "recover";
    p.phaseMs = 0;
    p.phaseDurMs = TIMING.MISSED_PARRY_RECOVER_MS;
    p.blockPressAt = -Infinity;
  }

  if (p.blockHeld || missed) {
    const dmg = Math.round(raw * (1 - w.blockPct));
    let cost = STAMINA.costBlockHit + raw * STAMINA.chipPerDamage;
    if (p.winded > 0 || p.stamina <= 0) cost *= STAMINA.windedBlockMult;
    drain(p, cost);
    return { kind: missed ? "missedParry" : "blocked", damage: dmg };
  }

  // Clean hit: interrupts attacks, flinches, and knocks back away from the attacker.
  p.health = Math.max(0, p.health - raw);
  p.attack = null;
  p.strikeFired = false;
  p.counterMs = 0;
  p.phase = "hit";
  p.phaseMs = 0;
  p.phaseDurMs = TIMING.HIT_STUN_MS;
  const dx = p.x - fromX;
  const dz = p.z - fromZ;
  const len = Math.hypot(dx, dz) || 1;
  p.kbX = (dx / len) * knockbackM * PLAYER.knockbackDecay;
  p.kbZ = (dz / len) * knockbackM * PLAYER.knockbackDecay;
  if (p.health <= 0) {
    p.dead = true;
    p.respawnMs = PLAYER.respawnMs;
    p.blockHeld = false;
    return { kind: "dead", damage: raw };
  }
  return { kind: "hit", damage: raw };
}

export function fistsWeapon(): WeaponStats {
  return WEAPONS.fists;
}
