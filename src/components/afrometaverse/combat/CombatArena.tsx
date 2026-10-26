import { useEffect, useMemo, useRef, useState } from "react";
import { CombatRuntime } from "@/systems/combat/combatRuntime";
import { createWorld, currentWeapon } from "@/systems/combat/combatLoop";
import { useCombatStore } from "@/stores/combatStore";
import { CombatFeedback } from "./CombatFeedback";
import { ARENA_HALF } from "@/systems/combat/combatTypes";
import { dispatchInput } from "@/systems/combat/combatLoop";
import "./combat.css";

/** Dev test arena: the player fights three dummies. Rendering is a flat top-down stub; the 3D scene is not wired yet. */
export function CombatArena() {
  const runtime = useMemo(() => new CombatRuntime(createWorld()), []);
  const [, force] = useState(0);
  const health = useCombatStore((s) => s.health);
  const stamina = useCombatStore((s) => s.stamina);
  const winded = useCombatStore((s) => s.winded);
  const slot = useCombatStore((s) => s.equippedSlot);
  const dead = useCombatStore((s) => s.dead);
  const timer = useRef<number>(0);
  // Only the HUD refreshes; the sim runs in the runtime.

  useEffect(() => {
    runtime.start(window);
    timer.current = window.setInterval(() => force((n) => (n + 1) % 1000), 100);
    return () => {
      runtime.stop();
      window.clearInterval(timer.current);
      useCombatStore.getState().clearFeed();
    };
  }, [runtime]);

  const w = runtime.world;
  const weapon = currentWeapon(w);
  const pct = (n: number, max: number) => `${Math.max(0, Math.min(100, (n / max) * 100))}%`;
  const scale = 100 / (ARENA_HALF * 2);
  const toPct = (v: number) => 50 + v * scale;

  return (
    <section className="am-combat-arena" aria-label="Combat test arena">
      <div className="am-combat-arena-map" role="img" aria-label="arena top-down">
        <div className="am-combat-player" style={{ left: `${toPct(w.player.x)}%`, top: `${toPct(-w.player.z)}%` }} />
        {w.enemies.map((e) => (
          <div
            key={e.id}
            className={`am-combat-dummy am-combat-dummy-${e.state}`}
            style={{ left: `${toPct(e.x)}%`, top: `${toPct(-e.z)}%` }}
          >
            <span className="am-combat-dummy-hp" style={{ width: pct(e.hp, e.maxHp) }} />
          </div>
        ))}
        <CombatFeedback />
      </div>
      <div className="am-combat-bars">
        <div className="am-combat-bar"><div className="am-combat-bar-fill am-combat-bar-fill-hp" style={{ width: pct(health, 100) }} /></div>
        <div className="am-combat-bar"><div className="am-combat-bar-fill am-combat-bar-fill-stamina" style={{ width: pct(stamina, 100) }} /></div>
      </div>
      <div className="am-combat-controls">
        <button type="button" className="am-btn am-btn-secondary" onPointerDown={() => dispatchInput(w, { type: "lightAttack", phase: "down" })}>light</button>
        <button type="button" className="am-btn am-btn-secondary" onPointerDown={() => dispatchInput(w, { type: "heavyAttack", phase: "down" })}>heavy</button>
        <button type="button" className="am-btn am-btn-secondary" onPointerDown={() => dispatchInput(w, { type: "block", phase: "down" })} onPointerUp={() => dispatchInput(w, { type: "block", phase: "up" })}>block</button>
        <button type="button" className="am-btn am-btn-secondary" onPointerDown={() => dispatchInput(w, { type: "dodge", phase: "down" })}>dodge</button>
      </div>
      <p className="am-combat-status">
        {weapon.name} (slot {slot}) {winded ? "winded" : ""} {dead ? "down, respawning" : ""}
      </p>
      <p className="am-combat-note">WASD move, J light, K heavy, Q block, Space dodge, 1 to 4 weapon. Dev only.</p>
    </section>
  );
}

export default CombatArena;
