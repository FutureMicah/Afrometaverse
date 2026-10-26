import { describe, expect, it } from "vitest";
import { NPC_SPECS, anchorFor, nearestLanePoint, stepToward, reactToPlayer } from "@/lib/npcSim";
import { villageObstacles, isFree, resolveCollision } from "@/lib/villageCollision";
import { WORLD_BOUNDS, NPC_RADIUS, LANES } from "@/lib/villageLayout";
import { villageObstacles as _v } from "@/lib/villageCollision";

describe("village collision", () => {
  it("builds obstacles from hut, tree, wall and pond data", () => {
    expect(villageObstacles().length).toBeGreaterThan(40);
  });

  it("pushes a body out of a hut and never lets it stand inside a wall", () => {
    const obs = villageObstacles();
    const p = resolveCollision(-3.8, 3.4, NPC_RADIUS, obs); // compound centre
    expect(isFree(p.x, p.z, NPC_RADIUS, obs)).toBe(true);
  });

  it("clamps to world bounds", () => {
    const p = resolveCollision(999, -999, 0.3);
    expect(p.x).toBeLessThanOrEqual(WORLD_BOUNDS.maxX);
    expect(p.z).toBeGreaterThanOrEqual(WORLD_BOUNDS.minZ);
  });
});

describe("npc population", () => {
  it("spawns 20 to 35 NPCs, each with a role", () => {
    expect(NPC_SPECS.length).toBeGreaterThanOrEqual(20);
    expect(NPC_SPECS.length).toBeLessThanOrEqual(35);
    for (const s of NPC_SPECS) expect(s.role).toMatch(/trader|fisher|guard|elder|herder|farmer|chief/);
  });

  it("every NPC spawns collision-free and inside the world", () => {
    const obs = villageObstacles();
    for (const s of NPC_SPECS) {
      expect(isFree(s.home.x, s.home.z, NPC_RADIUS, obs), `${s.id} at ${s.home.x},${s.home.z}`).toBe(true);
      expect(s.home.x).toBeGreaterThanOrEqual(WORLD_BOUNDS.minX);
      expect(s.home.x).toBeLessThanOrEqual(WORLD_BOUNDS.maxX);
    }
  });

  it("guard anchors stay on the main road lane", () => {
    const guards = NPC_SPECS.filter((s) => s.role === "guard");
    expect(guards.length).toBe(4);
    for (const g of guards) {
      for (let t = 0; t < 30; t += 3) {
        const a = anchorFor(g, t);
        const lane = nearestLanePoint(a.x, a.z);
        expect(Math.hypot(lane.x - a.x, lane.z - a.z)).toBeLessThan(0.05);
      }
    }
  });

  it("stepToward never enters a building", () => {
    const obs = villageObstacles();
    let p = { x: -9, z: -0.4 };
    for (let i = 0; i < 400; i++) p = stepToward(p, { x: 8, z: -0.4 }, 1.2, 0.05);
    expect(isFree(p.x, p.z, NPC_RADIUS, obs)).toBe(true);
  });

  it("reactToPlayer nudges away only when close", () => {
    expect(reactToPlayer({ x: 0, z: 0 }, { x: 10, z: 10 })).toBeNull();
    const n = reactToPlayer({ x: 0, z: 0 }, { x: 1, z: 0 });
    expect(n).not.toBeNull();
    expect(n!.x).toBeLessThan(0);
  });

  it("lanes exist", () => {
    expect(LANES.length).toBeGreaterThan(3);
  });
});
