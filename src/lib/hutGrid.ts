/**
 * Placement grid for the family compound hut (era-progression-spec.md 18.2).
 * Pure functions: the store applies them, tests check them.
 */

import { footprintAt, type DecorItem } from "@/data/decor";

/** Grid cell size in metres. Items snap to this grid. */
export const GRID_STEP = 0.5;

/** Placeable floor inside the walls (metres, room-local coordinates). */
export const FLOOR_BOUNDS = { minX: -2.6, maxX: 2.6, minZ: -2.2, maxZ: 2.2 };

/** Hearth in the safehouse: no decor may sit within this radius of it. */
export const HEARTH = { x: -1.6, z: -1.2, radius: 0.9 };

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Areas that always stay clear: door clearance in front of the doorway, and the sleep spot by the back wall. */
export const RESERVED_RECTS: Rect[] = [
  { minX: 0, maxX: 2.6, minZ: 1.6, maxZ: 2.5 },
  { minX: -0.9, maxX: 0.9, minZ: -2.7, maxZ: -1.7 },
];

export interface Placement {
  uid: string;
  itemId: string;
  x: number;
  z: number;
  rot: number;
}

export type PlaceRefusal = "out-of-bounds" | "hearth" | "reserved" | "overlap";

export function snap(v: number): number {
  return Math.round(v / GRID_STEP) * GRID_STEP;
}

/** Footprint rectangle of a placed item (x, z is its centre). */
export function rectFor(item: DecorItem, x: number, z: number, rot: number): Rect {
  const { w, d } = footprintAt(item, rot);
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;
}

function circleTouchesRect(cx: number, cz: number, r: number, rect: Rect): boolean {
  const nx = Math.min(Math.max(cx, rect.minX), rect.maxX);
  const nz = Math.min(Math.max(cz, rect.minZ), rect.maxZ);
  const dx = cx - nx;
  const dz = cz - nz;
  return dx * dx + dz * dz < r * r;
}

/**
 * Check whether an item can sit at (x, z) with rotation rot, given the other placements.
 * Returns null when it fits, otherwise the reason. `ignoreUid` lets a moved item skip itself.
 */
export function checkPlacement(
  item: DecorItem,
  x: number,
  z: number,
  rot: number,
  others: Placement[],
  catalog: Record<string, DecorItem>,
  ignoreUid?: string,
): PlaceRefusal | null {
  const r = rectFor(item, x, z, rot);
  if (r.minX < FLOOR_BOUNDS.minX || r.maxX > FLOOR_BOUNDS.maxX || r.minZ < FLOOR_BOUNDS.minZ || r.maxZ > FLOOR_BOUNDS.maxZ) {
    return "out-of-bounds";
  }
  if (circleTouchesRect(HEARTH.x, HEARTH.z, HEARTH.radius, r)) return "hearth";
  for (const res of RESERVED_RECTS) {
    if (overlaps(r, res)) return "reserved";
  }
  for (const p of others) {
    if (p.uid === ignoreUid) continue;
    const other = catalog[p.itemId];
    if (!other) continue;
    if (overlaps(r, rectFor(other, p.x, p.z, p.rot))) return "overlap";
  }
  return null;
}

/** First free grid spot (scanning rows) that fits the item, or null when the floor is full. */
export function firstFreeSpot(
  item: DecorItem,
  rot: number,
  others: Placement[],
  catalog: Record<string, DecorItem>,
): { x: number; z: number } | null {
  for (let z = FLOOR_BOUNDS.minZ + GRID_STEP / 2; z <= FLOOR_BOUNDS.maxZ; z += GRID_STEP) {
    for (let x = FLOOR_BOUNDS.minX + GRID_STEP / 2; x <= FLOOR_BOUNDS.maxX; x += GRID_STEP) {
      const sx = snap(x);
      const sz = snap(z);
      if (checkPlacement(item, sx, sz, rot, others, catalog) === null) return { x: sx, z: sz };
    }
  }
  return null;
}
