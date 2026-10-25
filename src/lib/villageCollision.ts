import { VILLAGE_HUTS, VILLAGE_TREES, VILLAGE_ROCKS, VILLAGE_WALLS, VILLAGE_HEARTHS, VILLAGE_HERITAGE, hutRadius, segmentIsGate } from "@/lib/villageProps";
import { POND, WORLD_BOUNDS } from "@/lib/villageLayout";

/**
 * Village collision: circles (huts, trees, rocks, hearths, pond, heritage compounds) and capsules
 * (compound wall segments). A body is pushed out of every obstacle it overlaps, so it slides along
 * walls instead of passing through them. Pure functions, shared by the player and NPC sim.
 */

export interface CircleObstacle {
  kind: "circle";
  x: number;
  z: number;
  r: number;
}
export interface CapsuleObstacle {
  kind: "capsule";
  ax: number;
  az: number;
  bx: number;
  bz: number;
  r: number;
}
export type Obstacle = CircleObstacle | CapsuleObstacle;

let cached: Obstacle[] | null = null;

/** All static obstacles for the village. Built once. */
export function villageObstacles(): Obstacle[] {
  if (cached) return cached;
  const out: Obstacle[] = [];
  for (const h of VILLAGE_HUTS) out.push({ kind: "circle", x: h.x, z: h.z, r: hutRadius(h) });
  for (const [x, z, s] of VILLAGE_TREES) out.push({ kind: "circle", x, z, r: 0.45 * s });
  for (const [x, z, s] of VILLAGE_ROCKS) out.push({ kind: "circle", x, z, r: 0.4 * s });
  for (const [x, z] of VILLAGE_HEARTHS) out.push({ kind: "circle", x, z, r: 0.55 });
  for (const c of VILLAGE_HERITAGE) out.push({ kind: "circle", x: c.x, z: c.z, r: c.r });
  out.push({ kind: "circle", x: POND.x, z: POND.z, r: POND.r });
  for (const [x, z, radius, n, gate] of VILLAGE_WALLS) {
    // compound wall = ring of posts joined by capsules; the gate segment stays open
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return { x: x + Math.cos(a) * radius, z: z + Math.sin(a) * radius };
    });
    for (let i = 0; i < n; i++) {
      if (gate !== undefined && segmentIsGate(i, n, gate)) continue;
      const p = pts[i]!;
      const q = pts[(i + 1) % n]!;
      out.push({ kind: "capsule", ax: p.x, az: p.z, bx: q.x, bz: q.z, r: 0.12 });
    }
  }
  cached = out;
  return out;
}

/** Closest point on segment a-b to (px, pz). */
function closestOnSegment(ax: number, az: number, bx: number, bz: number, px: number, pz: number): [number, number] {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return [ax + dx * t, az + dz * t];
}

/**
 * Push a body of radius `radius` at (x, z) out of every obstacle it overlaps, then clamp to the
 * world bounds. Iterates a few times so corners settle. Returns the resolved position.
 */
export function resolveCollision(x: number, z: number, radius: number, obstacles: Obstacle[] = villageObstacles()): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (let iter = 0; iter < 3; iter++) {
    for (const o of obstacles) {
      let cx: number;
      let cz: number;
      if (o.kind === "circle") {
        cx = o.x;
        cz = o.z;
      } else {
        [cx, cz] = closestOnSegment(o.ax, o.az, o.bx, o.bz, px, pz);
      }
      const r = (o.kind === "circle" ? o.r : o.r) + radius;
      const dx = px - cx;
      const dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      const d = Math.sqrt(d2);
      if (d < 1e-6) {
        // exactly on the centre: push out along +x
        px = cx + r;
        continue;
      }
      px = cx + (dx / d) * r;
      pz = cz + (dz / d) * r;
    }
  }
  return {
    x: Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, px)),
    z: Math.max(WORLD_BOUNDS.minZ, Math.min(WORLD_BOUNDS.maxZ, pz)),
  };
}

/** True if a body of `radius` at (x, z) overlaps no obstacle. */
export function isFree(x: number, z: number, radius: number, obstacles: Obstacle[] = villageObstacles()): boolean {
  for (const o of obstacles) {
    const [cx, cz] = o.kind === "circle" ? [o.x, o.z] : closestOnSegment(o.ax, o.az, o.bx, o.bz, x, z);
    const r = o.r + radius;
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < r * r) return false;
  }
  return true;
}
