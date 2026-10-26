import { useCombatStore } from "@/stores/combatStore";
import { attachKeyboard, type CombatInput } from "./inputMap";
import { createWorld, dispatchInput, pruneEvents, stepCombat, type CombatWorld } from "./combatLoop";

/** Fixed 60 Hz simulation step. */
export const STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 5;

/**
 * Drives the combat world from requestAnimationFrame and pushes new events into combatStore.
 * Keeps a single world per runtime. The world is mutated in place (no per-frame allocation in the hot path).
 */
export class CombatRuntime {
  readonly world: CombatWorld;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private detach: (() => void) | null = null;
  private seenEvent = 0;
  private running = false;

  constructor(world: CombatWorld = createWorld()) {
    this.world = world;
  }

  dispatch = (input: CombatInput) => dispatchInput(this.world, input);

  start(target: Window = window) {
    if (this.running) return;
    this.running = true;
    this.detach = attachKeyboard(target, this.dispatch);
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      this.tick(now);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.detach?.();
    this.detach = null;
  }

  /** Advance by real time, clamped to 5 fixed steps so a background tab does not explode. */
  tick(now: number) {
    let frameMs = now - this.last;
    this.last = now;
    if (frameMs > 250) frameMs = 250;
    this.acc += frameMs;
    let steps = 0;
    while (this.acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      stepCombat(this.world, STEP_MS);
      this.acc -= STEP_MS;
      steps += 1;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
    pruneEvents(this.world, 2000);
    this.publish();
  }

  /** Copy vitals to the store and forward only new events. Store writes are skipped when unchanged. */
  publish() {
    const w = this.world;
    const p = w.player;
    const s = useCombatStore.getState();
    const winded = p.winded > 0;
    const phase = p.phase;
    if (
      s.health !== p.health ||
      s.stamina !== Math.round(p.stamina) ||
      s.winded !== winded ||
      s.phase !== phase ||
      s.dead !== p.dead ||
      s.equippedSlot !== w.slot
    ) {
      useCombatStore.getState().syncVitals({
        health: p.health,
        stamina: Math.round(p.stamina),
        winded,
        phase,
        dead: p.dead,
        equippedSlot: w.slot,
      });
    }
    for (const ev of w.events) {
      if (ev.id <= this.seenEvent) continue;
      this.seenEvent = ev.id;
      useCombatStore.getState().pushFeed({
        kind: ev.kind,
        x: ev.x,
        z: ev.z,
        amount: ev.amount,
        critical: ev.critical,
        atMs: ev.atMs,
      });
    }
  }
}
