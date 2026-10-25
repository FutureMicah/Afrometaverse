/**
 * Open village layout (Erangel-style region): wide main road, named landmarks, breathing room.
 *
 * Pure data, no three.js. Huts, trees, walls and stalls are placed clear of these lanes
 * (villageProps.ts). Collision (villageCollision.ts) and the NPC sim (npcSim.ts) both read this
 * file, so walkable space and drawn space stay in sync.
 *
 * Axes: +x east, +z south. Lanes are walkable centre lines.
 */

export interface Pt {
  x: number;
  z: number;
}

/** Playable region in world metres. Players and NPCs are clamped inside. */
export const WORLD_BOUNDS = { minX: -24, maxX: 22, minZ: -20, maxZ: 18 } as const;

/** Four world landmarks that the layout is built around (chunks, collision, roads). */

/** Collision radius of the player body (metres). */
export const PLAYER_RADIUS = 0.35;
/** Collision radius of an NPC body (metres). */
export const NPC_RADIUS = 0.32;

/** Still water. Nothing walks into it. */
export const POND = { x: -5.5, z: -5.4, r: 3.8 } as const;

/** Market square: a raised ochre disc. Stalls sit inside, the walkway loops around the middle. */
export const MARKET_SQUARE = { x: -3, z: 4.5, r: 5 } as const;

/** Chief's compound: walled ring, gate faces the main road (south side, +z). */
export const CHIEF_COMPOUND = { x: 4, z: -10, r: 3.2, gate: Math.PI / 2 } as const;

/** Farm outskirts: fenced crop rows at the far south-east edge. */
export const FARM = { x: 16, z: 12 } as const;

/** Port compound south of the main road (replaces the old port landmark). */
export const PORT = { x: 11.2, z: 5.2 } as const;

/** Main east-west road runs along this z. */
export const MAIN_ROAD_Z = -0.4;
/** Half width of the main road and the lane clearance used by the placement test. */
export const MAIN_ROAD_HALF = 1.4;

/** Named district landmarks (ids match roamStore DISTRICT_WORLD). */
export const LANDMARK_POSITIONS: Record<string, Pt> = {
  "town-market": { x: MARKET_SQUARE.x, z: MARKET_SQUARE.z },
  "civic-centre": { x: CHIEF_COMPOUND.x, z: CHIEF_COMPOUND.z },
  creekside: { x: -5.5, z: -1.4 },
  port: { x: PORT.x, z: PORT.z },
};

/** Market stall tables (x, z). Their footprint is STALL_HALF. */
export const MARKET_STALLS: ReadonlyArray<Pt> = [
  { x: -6.4, z: 3.2 },
  { x: -6.4, z: 5.8 },
  { x: 0.4, z: 3.2 },
  { x: 0.4, z: 5.8 },
];
export const STALL_HALF = { hw: 0.5, hd: 0.26 } as const;

function ring(c: Pt, r: number, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push({ x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r });
  }
  return out;
}

/**
 * Walkable lanes (polylines). NPCs only walk these, so they never cut through huts or walls.
 * Checked against the obstacle set in the test suite.
 */
export const LANES: Pt[][] = [
  // main east-west road, wide and straight
  [-22, -12, -6, 0, 6, 12, 20].map((x) => ({ x, z: MAIN_ROAD_Z })),
  // market plaza walkway loop, clear of the stalls
  ring(MARKET_SQUARE, 2.6, 16),
  // spur from the main road into the market plaza
  [
    { x: -3, z: MAIN_ROAD_Z },
    { x: -3, z: MARKET_SQUARE.z - 2.6 },
  ],
  // road from the main road up to the chief's compound gate
  [
    { x: 4, z: MAIN_ROAD_Z },
    { x: 4, z: CHIEF_COMPOUND.z + 3.6 },
  ],
  // waterside spur down to the pond shore
  [
    { x: -5.5, z: MAIN_ROAD_Z },
    { x: -5.5, z: -1.6 },
  ],
  // shore path around the pond, clear of the water by more than NPC_RADIUS
  ring(POND, POND.r + 0.7, 24),
  // farm road south-east to the crop rows
  [
    { x: 12, z: MAIN_ROAD_Z },
    { x: 14, z: 3 },
    { x: 16, z: 8 },
    { x: FARM.x - 1, z: FARM.z - 2 },
  ],
];

/** Guard patrol routes: ping-pong between two waypoints on lane. */
export const GUARD_ROUTES: Array<{ id: string; a: Pt; b: Pt }> = [
  { id: "road-west", a: { x: -14, z: MAIN_ROAD_Z }, b: { x: 6, z: MAIN_ROAD_Z } },
  { id: "chief-gate", a: { x: 4, z: MAIN_ROAD_Z }, b: { x: 12, z: MAIN_ROAD_Z } },
];
