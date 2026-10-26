import { describe, expect, it } from "vitest";
import { computeDamage, meleeBaseDamage, parryGrade, isInMeleeArc, CRIT_MULT } from "@/systems/combat/damage";
import { WEAPONS, bowShotDamage } from "@/systems/combat/weapons";
import { createPlayer, startAttack, startDodge, setBlock, takeHit, tickPlayer, drain, type PlayerCombat } from "@/systems/combat/playerFsm";
import { createDummy, enemyTakeHit, stepDummy, DUMMY } from "@/systems/combat/dummyAI";
import { STAMINA, TIMING } from "@/systems/combat/combatTypes";

const machete = WEAPONS.machete;

function run(p: PlayerCombat, ms: number) {
  for (let t = 0; t < ms; t += 1000 / 60) tickPlayer(p, 1000 / 60, machete);
}

describe("damage calc", () => {
  it("applies block reduction and rounds", () => {
    expect(computeDamage({ base: 34, blocking: true, blockPct: 0.4, critical: false }).damage).toBe(20);
  });
  it("crit adds 50 percent before block", () => {
    expect(computeDamage({ base: 10, blocking: false, blockPct: 0, critical: true }).damage).toBe(Math.round(10 * CRIT_MULT));
  });
  it("never negative and clamps block pct", () => {
    expect(computeDamage({ base: 5, blocking: true, blockPct: 2, critical: false }).damage).toBe(0);
  });
  it("light chain finisher is stronger than the first hit", () => {
    expect(meleeBaseDamage(machete, "light", 2)).toBeGreaterThan(meleeBaseDamage(machete, "light", 0));
    expect(meleeBaseDamage(machete, "heavy", 0)).toBe(machete.heavyDamage);
  });
  it("bow charge table grows with hold time", () => {
    expect(bowShotDamage(0)).toBeLessThan(bowShotDamage(500));
    expect(bowShotDamage(2500)).toBe(WEAPONS.bow.heavyDamage);
  });
  it("arc test passes in front and fails behind", () => {
    expect(isInMeleeArc(0, 0, 0, 0, 1, 2, 120)).toBe(true);
    expect(isInMeleeArc(0, 0, 0, 0, -1, 2, 120)).toBe(false);
    expect(isInMeleeArc(0, 0, 0, 0, 5, 2, 120)).toBe(false);
  });
  it("parry grades: window and perfect centre", () => {
    expect(parryGrade(50, 150)).toBe("perfect");
    expect(parryGrade(120, 150)).toBe("parry");
    expect(parryGrade(-20, 150)).toBe("parry");
    expect(parryGrade(-80, 150)).toBe("none");
    expect(parryGrade(300, 150)).toBe("none");
  });
});

describe("attack state machine", () => {
  it("walks windup -> strike -> recover -> idle", () => {
    const p = createPlayer();
    expect(startAttack(p, "light", machete)).toBe("started");
    expect(p.phase).toBe("windup");
    run(p, machete.light.windupMs + 5);
    expect(p.phase).toBe("strike");
    run(p, machete.light.strikeMs + 5);
    expect(p.phase).toBe("recover");
    run(p, machete.light.recoverMs + 5);
    expect(p.phase).toBe("idle");
  });
  it("chains a second light during recovery but not a heavy", () => {
    const p = createPlayer();
    startAttack(p, "light", machete);
    run(p, machete.light.windupMs + machete.light.strikeMs + 5);
    expect(p.phase).toBe("recover");
    expect(startAttack(p, "heavy", machete)).toBe("busy");
    expect(startAttack(p, "light", machete)).toBe("started");
    expect(p.strikeIndex).toBe(1);
  });
  it("caps the chain at lightChain then resets", () => {
    const p = createPlayer();
    for (let i = 0; i < machete.lightChain; i++) {
      expect(startAttack(p, "light", machete)).toBe("started");
      run(p, 600);
    }
    expect(p.phase).toBe("idle");
    expect(startAttack(p, "light", machete)).toBe("started");
    expect(p.strikeIndex).toBe(0);
  });
  it("heavy cannot start while busy", () => {
    const p = createPlayer();
    startAttack(p, "light", machete);
    expect(startAttack(p, "heavy", machete)).toBe("busy");
  });
  it("unarmed bow refuses melee", () => {
    const p = createPlayer();
    expect(startAttack(p, "light", WEAPONS.bow)).toBe("unsupported");
  });
});

describe("stamina rules", () => {
  it("attack costs stamina and refuses at zero", () => {
    const p = createPlayer();
    p.stamina = STAMINA.costLight - 1;
    expect(startAttack(p, "light", machete)).toBe("noStamina");
  });
  it("zero stamina triggers winded and blocks attacks and dodge", () => {
    const p = createPlayer();
    drain(p, p.stamina);
    expect(p.winded).toBe(TIMING.WINDED_MS);
    expect(startAttack(p, "light", machete)).toBe("winded");
    expect(startDodge(p)).toBe("winded");
  });
  it("stamina regenerates at idle and not while blocking", () => {
    const p = createPlayer();
    p.stamina = 50;
    run(p, 1000);
    expect(p.stamina).toBeCloseTo(50 + STAMINA.regenIdle, 0);
    p.stamina = 50;
    setBlock(p, true, 0);
    run(p, 1000);
    expect(p.stamina).toBe(50);
  });
  it("never regenerates past max", () => {
    const p = createPlayer();
    run(p, 10000);
    expect(p.stamina).toBe(STAMINA.max);
  });
  it("a blocked hit costs stamina", () => {
    const p = createPlayer();
    setBlock(p, true, 0);
    const before = p.stamina;
    const r = takeHit(p, 10, 500, machete, 0, 3, 0);
    expect(r.kind).toBe("blocked");
    expect(r.damage).toBe(Math.round(10 * (1 - machete.blockPct)));
    expect(p.stamina).toBeLessThan(before);
  });
});

describe("dodge and i-frames", () => {
  it("dodge costs stamina and rolls", () => {
    const p = createPlayer();
    p.moveX = 1;
    expect(startDodge(p)).toBe("started");
    expect(p.stamina).toBe(STAMINA.max - STAMINA.costDodge);
    expect(p.phase).toBe("dodge");
  });
  it("i-frame window dodges an incoming hit", () => {
    const p = createPlayer();
    startDodge(p);
    run(p, TIMING.DODGE_IFRAME_START_MS + 20);
    const r = takeHit(p, 10, 0, machete, 0, 3, 0);
    expect(r.kind).toBe("dodged");
    expect(p.health).toBe(p.maxHealth);
  });
  it("outside i-frames the hit lands", () => {
    const p = createPlayer();
    startDodge(p);
    const r = takeHit(p, 10, 0, machete, 0, 3, 0);
    expect(r.kind).toBe("hit");
    expect(p.health).toBe(p.maxHealth - 10);
  });
  it("heavy windup can be cancelled by a roll, light cannot", () => {
    const p = createPlayer();
    startAttack(p, "heavy", machete);
    expect(startDodge(p)).toBe("started");
    const q = createPlayer();
    startAttack(q, "light", machete);
    expect(startDodge(q)).toBe("busy");
  });
});

describe("parry and block", () => {
  it("a press inside the parry window parries with no damage", () => {
    const p = createPlayer();
    setBlock(p, true, 1000);
    const r = takeHit(p, 10, 1100, machete, 0, 3, 0);
    expect(r.kind).toBe("parried");
    expect(p.health).toBe(p.maxHealth);
  });
  it("a tap that is too early is a missed parry with recovery", () => {
    const p = createPlayer();
    setBlock(p, true, 1000);
    setBlock(p, false, 1010);
    setBlock(p, true, 1020);
    const r = takeHit(p, 10, 1220, machete, 0, 3, 0);
    expect(r.kind).toBe("missedParry");
    expect(p.phase).toBe("recover");
  });
});

describe("health and knockback", () => {
  it("clean hit flinches and knocks back", () => {
    const p = createPlayer(0, 0);
    const r = takeHit(p, 10, 0, machete, 0, 2, machete.knockbackM);
    expect(r.kind).toBe("hit");
    expect(p.phase).toBe("hit");
    expect(p.z).toBe(0);
    expect(p.kbZ).toBeLessThan(0);
  });
  it("death at zero health", () => {
    const p = createPlayer();
    p.health = 5;
    const r = takeHit(p, 10, 0, machete, 0, 2, 0);
    expect(r.kind).toBe("dead");
    expect(p.dead).toBe(true);
    expect(p.respawnMs).toBeGreaterThan(0);
  });
});

describe("dummy enemy", () => {
  it("takes damage and dies at zero, then respawns", () => {
    const d = createDummy("t", 0, 3);
    const r = enemyTakeHit(d, d.maxHp, 0, 0, 1, 0);
    expect(r.killed).toBe(true);
    expect(d.state).toBe("dead");
    let t = 0;
    while (d.state === "dead" && t < 10000) {
      stepDummy(d, 1000 / 60, 0, 0);
      t += 1000 / 60;
    }
    expect(d.hp).toBe(d.maxHp);
    expect(d.state).toBe("idle");
  });
  it("aggro -> chase -> windup -> strike on a nearby player", () => {
    const d = createDummy("t", 0, 3);
    let seenStrike = 0;
    for (let t = 0; t < 4000; t += 1000 / 60) {
      seenStrike += stepDummy(d, 1000 / 60, 0, 0.5) ? 1 : 0;
    }
    expect(seenStrike).toBeGreaterThan(0);
  });
  it("stagger after enough stagger meter", () => {
    const d = createDummy("t", 0, 3);
    let staggered = false;
    for (let i = 0; i < 10 && !staggered; i++) {
      staggered = enemyTakeHit(d, 1, DUMMY.staggerAt / 2, 0, 1, 0).staggered;
    }
    expect(staggered).toBe(true);
  });
});
