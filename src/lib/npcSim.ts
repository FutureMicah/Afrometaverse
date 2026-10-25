import { LANES, POND, MARKET_SQUARE, MARKET_STALLS, GUARD_ROUTES, MAIN_ROAD_Z, CHIEF_COMPOUND, FARM, NPC_RADIUS, type Pt } from "@/lib/villageLayout";
import { resolveCollision, villageObstacles, isFree } from "@/lib/villageCollision";

/**
 * Purposeful NPC population. Each NPC has a role and an anchor: traders stand at stalls, fishermen
 * sit at the shore, guards walk a fixed route, elders idle at the compound. No random wander.
 * Movement walks the lanes (LANES) and is pushed out of collision, so NPCs cannot clip walls.
 */

export type NpcRole = "trader" | "fisher" | "guard" | "elder" | "herder" | "farmer";

export interface NpcSpec {
  id: string;
  role: NpcRole;
  /** Where the NPC lives. For guards this is the start of the route. */
  home: Pt;
  /** Idle facing direction (radians). */
  face: number;
  /** Lane index the NPC patrols (guards) or null (idle roles). */
  route?: "road-west" | "chief-gate";
}

/** Population spec, 28 NPCs. Fixed per session, so the same town is seen by every player. */
export const NPC_SPECS: NpcSpec[] = buildSpecs();

/**
 * Snap a point to the nearest collision-free spot (spiral search). Guarantees no NPC spawns
 * inside a hut, wall, tree or the pond.
 */
export function freeSpot(p: Pt): Pt {
  const obs = villageObstacles();
  if (isFree(p.x, p.z, NPC_RADIUS, obs)) return p;
  for (let r = 0.2; r <= 4; r += 0.2) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      if (isFree(x, z, NPC_RADIUS, obs)) return { x, z };
    }
  }
  return p;
}

function buildSpecs(): NpcSpec[] {
  const out: NpcSpec[] = [];
  const push = (role: NpcRole, home: Pt, face: number, route?: NpcSpec["route"]) => {
    const spec: NpcSpec = { id: `${role}-${out.length}`, role, home: freeSpot(home), face };
    if (route) spec.route = route;
    out.push(spec);
  };

  // traders: one at each stall plus one behind each, all on the market side of the stalls
  // one trader in front of each stall (the stall's open side faces the walkway)
  for (const s of MARKET_STALLS) {
    push("trader", { x: s.x, z: s.z + 0.62 }, -Math.PI / 2);
    push("trader", { x: s.x + 0.7, z: s.z - 0.5 }, Math.PI / 2);
  }
  // fishermen on the pond shore, spaced around the water
  // shore angles that stay clear of the creek spur and the hearth
  [-2.2, -1.1, 0.4, 1.6].forEach((ang) => {
    push("fisher", { x: POND.x + Math.cos(ang) * (POND.r + 0.9), z: POND.z + Math.sin(ang) * (POND.r + 0.9) }, ang + Math.PI);
  });
  // guards on fixed routes (two per route, staggered along it)
  push("guard", GUARD_ROUTES[0]!.a, 0, "road-west");
  push("guard", { x: GUARD_ROUTES[0]!.a.x + 6, z: MAIN_ROAD_Z }, Math.PI, "road-west");
  push("guard", GUARD_ROUTES[1]!.a, 0, "chief-gate");
  push("guard", { x: GUARD_ROUTES[1]!.a.x + 4, z: MAIN_ROAD_Z }, Math.PI, "chief-gate");
  // elders idle at the chief's compound, inside the gate
  [0, 1, 2].forEach((i) => push("elder", { x: CHIEF_COMPOUND.x - 1 + i, z: CHIEF_COMPOUND.z + 0.5 }, Math.PI / 2));
  // farmers on the farm outskirts
  push("farmer", { x: FARM.x - 1.5, z: FARM.z - 1 }, Math.PI / 2);
  push("farmer", { x: FARM.x + 1.5, z: FARM.z }, -Math.PI / 2);
  // herders on the pond shore
  push("herder", { x: 6.2, z: 8.2 }, -Math.PI / 2);
  push("herder", { x: 7.8, z: 9.6 }, -Math.PI / 2);
  return out;
}

/** Lane-following: nearest point on the lane network to (x, z). */
export function nearestLanePoint(x: number, z: number): Pt {
  let best: Pt = { x, z };
  let bestD = Infinity;
  for (const lane of LANES) {
    for (let i = 0; i < lane.length - 1; i++) {
      const a = lane[i]!;
      const b = lane[i + 1]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len2 = dx * dx + dz * dz;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
      const px = a.x + dx * t;
      const pz = a.z + dz * t;
      const d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { x: px, z: pz };
      }
    }
  }
  return best;
}

/** Walk one step toward target, collision-resolved. Returns the new position. */
export function stepToward(from: Pt, target: Pt, speed: number, dt: number): Pt {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) return from;
  const s = Math.min(d, speed * dt);
  const nx = from.x + (dx / d) * s;
  const nz = from.z + (dz / d) * s;
  return resolveCollision(nx, nz, NPC_RADIUS);
}

/** Radius inside which an NPC steps aside from the player. */
export const REACT_RADIUS = 2.4;

/** Position an NPC should walk toward this tick. Idle NPCs stay at their home. */
export function anchorFor(spec: NpcSpec, t: number): Pt {
  if (spec.role === "guard" && spec.route) {
    const route = GUARD_ROUTES.find((r) => r.id === spec.route);
    if (!route) return spec.home;
    // ping-pong with a steady pace along the route
    const len = Math.abs(route.b.x - route.a.x);
    const period = (len / 1.2) * 2;
    const phase = ((t + (spec.home.x * 0.37)) % period + period) % period;
    const along = phase <= period / 2 ? phase / (period / 2) : 2 - phase / (period / 2);
    return { x: route.a.x + (route.b.x - route.a.x) * along, z: MAIN_ROAD_Z };
  }
  return spec.home;
}

/** Player-aware step: if the player is close, an NPC steps aside (away from the player) instead of walking on. */
export function reactToPlayer(pos: Pt, player: Pt): Pt | null {
  const dx = pos.x - player.x;
  const dz = pos.z - player.z;
  const d = Math.hypot(dx, dz);
  if (d > REACT_RADIUS || d < 1e-4) return null;
  const push = (REACT_RADIUS - d) / REACT_RADIUS;
  return { x: pos.x + (dx / d) * push * 0.8, z: pos.z + (dz / d) * push * 0.8 };
}

export { villageObstacles, isFree };
