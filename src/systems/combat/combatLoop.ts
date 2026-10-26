import { ARENA_HALF } from "./combatTypes";
import { createDummy, DUMMY, DUMMY_STRIKE_BEGAN, dummyCanHit, enemyTakeHit, isStaggered, stepDummy, type DummyEnemy } from "./dummyAI";
import { isInMeleeArc, knockDir, meleeBaseDamage, computeDamage, CRIT_MULT } from "./damage";
import {
  createPlayer,
  FLAG_STRIKE_BEGAN,
  setBlock,
  setMove,
  startAttack,
  startDodge,
  takeHit,
  tickPlayer,
  type ActionResult,
  type PlayerCombat,
  type AttackKind,
} from "./playerFsm";
import { WEAPONS, WEAPON_BY_SLOT, bowShotDamage, type WeaponSlot, type WeaponStats } from "./weapons";
import type { CombatInput } from "./inputMap";

export type CombatEventKind =
  | "damage"
  | "kill"
  | "stagger"
  | "miss"
  | "blocked"
  | "parried"
  | "perfectParry"
  | "missedParry"
  | "dodged"
  | "playerHit"
  | "playerDown"
  | "playerRespawn"
  | "noStamina"
  | "winded"
  | "unsupported"
  | "bowShot";

export interface CombatEvent {
  id: number;
  kind: CombatEventKind;
  x: number;
  z: number;
  atMs: number;
  targetId: string;
  amount: number;
  critical: boolean;
}

export const DUMMY_SPAWNS = [
  { x: -3, z: 4 },
  { x: 0, z: 5.5 },
  { x: 3, z: 4 },
] as const;

export const EVENT_CAP = 40;

export interface CombatWorld {
  nowMs: number;
  slot: WeaponSlot;
  player: PlayerCombat;
  enemies: DummyEnemy[];
  events: CombatEvent[];
  seq: number;
}

export function createWorld(): CombatWorld {
  return {
    nowMs: 0,
    slot: 1,
    player: createPlayer(0, 0),
    enemies: DUMMY_SPAWNS.map((s, i) => createDummy(`dummy-${i + 1}`, s.x, s.z)),
    events: [],
    seq: 0,
  };
}

export function currentWeapon(w: CombatWorld): WeaponStats {
  return WEAPONS[WEAPON_BY_SLOT[w.slot]];
}

function emit(
  w: CombatWorld,
  kind: CombatEventKind,
  x: number,
  z: number,
  targetId = "",
  amount = 0,
  critical = false,
) {
  w.seq += 1;
  w.events.push({ id: w.seq, kind, x, z, atMs: w.nowMs, targetId, amount, critical });
  if (w.events.length > EVENT_CAP) w.events.splice(0, w.events.length - EVENT_CAP);
}

function reportAction(w: CombatWorld, r: ActionResult) {
  const p = w.player;
  if (r === "noStamina") emit(w, "noStamina", p.x, p.z);
  else if (r === "winded") emit(w, "winded", p.x, p.z);
  else if (r === "unsupported") emit(w, "unsupported", p.x, p.z);
}

/** Dispatch one abstract input into the world. The only entry point for keyboard, touch or gamepad. */
export function dispatchInput(w: CombatWorld, input: CombatInput): void {
  const p = w.player;
  const weapon = currentWeapon(w);
  switch (input.type) {
    case "lightAttack":
      if (input.phase === "down") reportAction(w, startAttack(p, "light", weapon));
      break;
    case "heavyAttack":
      if (input.phase !== "down") break;
      if (weapon.id === "bow") {
        // Bow stub: a charged shot is not wired. Reports the damage table value only.
        emit(w, "bowShot", p.x, p.z, "", bowShotDamage(0, weapon));
      } else {
        reportAction(w, startAttack(p, "heavy", weapon));
      }
      break;
    case "block":
      setBlock(p, input.phase === "down", w.nowMs);
      break;
    case "dodge":
      if (input.phase === "down") {
        const r = startDodge(p);
        if (r === "noStamina" || r === "winded") reportAction(w, r);
      }
      break;
    case "move":
      setMove(p, input.x, input.z);
      break;
    case "weapon":
      // Swapping is blocked mid-attack so a strike cannot change weapon in flight.
      if (p.phase === "idle" || p.phase === "block") w.slot = input.slot;
      break;
  }
}

function respawnPlayer(w: CombatWorld) {
  const p = w.player;
  p.health = p.maxHealth;
  p.stamina = p.maxStamina;
  p.winded = 0;
  p.dead = false;
  p.respawnMs = 0;
  p.phase = "idle";
  p.phaseMs = 0;
  p.attack = null;
  p.chainIndex = 0;
  p.counterMs = 0;
  p.blockHeld = false;
  p.x = 0;
  p.z = 0;
  p.kbX = 0;
  p.kbZ = 0;
  emit(w, "playerRespawn", p.x, p.z);
}

const dir = { x: 0, z: 0 };

function resolvePlayerStrike(w: CombatWorld, weapon: WeaponStats, kind: AttackKind) {
  const p = w.player;
  const reach = kind === "heavy" ? weapon.heavyReachM : weapon.reachM;
  const base = meleeBaseDamage(weapon, kind, p.strikeIndex);
  let hits = 0;
  for (const e of w.enemies) {
    if (e.state === "dead") continue;
    if (!isInMeleeArc(p.x, p.z, p.yaw, e.x, e.z, reach, weapon.arcDeg, DUMMY.radius)) continue;
    const critical = p.counterMs > 0 || isStaggered(e);
    const r = computeDamage({ base, blocking: false, blockPct: 0, critical });
    knockDir(p.x, p.z, e.x, e.z, dir);
    const stagger = kind === "heavy" ? weapon.staggerHeavy : weapon.staggerLight;
    const res = enemyTakeHit(e, r.damage, stagger, dir.x, dir.z, weapon.knockbackM);
    if (res.killed) emit(w, "kill", e.x, e.z, e.id, r.damage, critical);
    else emit(w, "damage", e.x, e.z, e.id, r.damage, critical);
    if (res.staggered) emit(w, "stagger", e.x, e.z, e.id, 0, true);
    hits += 1;
    if (hits >= weapon.maxTargets) break;
  }
  if (hits > 0) p.counterMs = 0;
  else emit(w, "miss", p.x, p.z);
}

function resolveEnemyStrike(w: CombatWorld, e: DummyEnemy, weapon: WeaponStats) {
  const p = w.player;
  if (!dummyCanHit(e, p.x, p.z)) {
    emit(w, "miss", e.x, e.z, e.id);
    return;
  }
  knockDir(e.x, e.z, p.x, p.z, dir);
  const fromX = e.x;
  const fromZ = e.z;
  const res = takeHit(p, DUMMY.damage, w.nowMs, weapon, fromX, fromZ, DUMMY.knockbackM);
  switch (res.kind) {
    case "dodged":
      emit(w, "dodged", p.x, p.z, e.id);
      break;
    case "parried":
      emit(w, "parried", p.x, p.z, e.id);
      break;
    case "perfectParry":
      emit(w, "perfectParry", p.x, p.z, e.id);
      break;
    case "missedParry":
      emit(w, "missedParry", p.x, p.z, e.id, res.damage);
      break;
    case "blocked":
      emit(w, "blocked", p.x, p.z, e.id, res.damage);
      break;
    case "hit":
      emit(w, "playerHit", p.x, p.z, e.id, res.damage);
      break;
    case "dead":
      emit(w, "playerDown", p.x, p.z, e.id, res.damage);
      break;
    default:
      break;
  }
}

/** Advance the whole combat world by dtMs (fixed step: call with 1000/60). */
export function stepCombat(w: CombatWorld, dtMs: number): void {
  w.nowMs += dtMs;
  const p = w.player;
  const weapon = currentWeapon(w);

  if (p.dead) {
    p.respawnMs -= dtMs;
    if (p.respawnMs <= 0) respawnPlayer(w);
  } else {
    const flags = tickPlayer(p, dtMs, weapon);
    if ((flags & FLAG_STRIKE_BEGAN) !== 0 && p.attack) resolvePlayerStrike(w, weapon, p.attack);
  }

  for (const e of w.enemies) {
    const f = stepDummy(e, dtMs, p.x, p.z);
    if (f === DUMMY_STRIKE_BEGAN && !p.dead) resolveEnemyStrike(w, e, weapon);
  }
}

/** Clears the events older than maxAgeMs so the event list stays small. */
export function pruneEvents(w: CombatWorld, maxAgeMs: number): void {
  const cutoff = w.nowMs - maxAgeMs;
  while (w.events.length > 0 && (w.events[0]?.atMs ?? 0) < cutoff) w.events.shift();
}

export { bowShotDamage, CRIT_MULT, ARENA_HALF };
