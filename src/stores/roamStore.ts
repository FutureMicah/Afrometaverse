import { create } from "zustand";

export type RoamMode = "orbit" | "walk" | "ride";

/** Locomotion for character animation */
export type MoveState = "idle" | "walk" | "run" | "ride";

/** All player mobility options */
export type TransportId =
  | "foot"
  | "bicycle"
  | "scooter"
  | "keke"
  | "okada"
  | "taxi"
  | "ferry";

/** Abstract in-game tools only — not real-world firearm designs. */
export type GearId = "none" | "sidearm" | "carbine" | "stun";

export type MissionKind = "legal" | "grey" | "heat";

export type MissionStep = {
  id: string;
  label: string;
  districtId: string;
  done: boolean;
  subSteps?: { id: string; label: string; done: boolean }[];
};

export type ActiveMission = {
  jobId: string;
  title: string;
  kind: MissionKind;
  reward: number;
  rep: number;
  heatOnFail: number;
  heatOnSuccess: number;
  requiredGear?: GearId;
  steps: MissionStep[];
  startedAt: number;
} | null;

export type GearLoadout = {
  equipped: GearId;
  unlocked: GearId[];
  ammo: Record<Exclude<GearId, "none">, number>;
};

export type WorldVehicle = {
  id: string;
  kind: Exclude<TransportId, "foot">;
  position: [number, number, number];
  facing: number;
  /** If taken by player */
  occupied: boolean;
};

export type Safehouse = {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  coolRate: number;
};

interface RoamState {
  mode: RoamMode;
  transport: TransportId;
  /** Vehicle instance player is inside, or null if on foot */
  mountedVehicleId: string | null;
  position: [number, number, number];
  facing: number;
  moveState: MoveState;
  nearDistrictId: string | null;
  nearVehicleId: string | null;
  inSafehouseId: string | null;
  activeMission: ActiveMission;
  missionLog: string[];
  wantedLevel: number;
  heatPoints: number;
  gear: GearLoadout;
  /** Which transport kinds the citizen may use */
  unlockedTransport: TransportId[];
  mapZoom: number;
  showMinimap: boolean;
  worldVehicles: WorldVehicle[];

  setMode: (mode: RoamMode) => void;
  setTransport: (t: TransportId) => void;
  setPosition: (pos: [number, number, number]) => void;
  setFacing: (yaw: number) => void;
  setMoveState: (s: MoveState) => void;
  setNearDistrict: (id: string | null) => void;
  setNearVehicle: (id: string | null) => void;
  setInSafehouse: (id: string | null) => void;
  startMission: (mission: NonNullable<ActiveMission>) => void;
  completeStep: (stepId: string) => void;
  completeSubStep: (stepId: string, subId: string) => void;
  clearMission: () => void;
  pushLog: (line: string) => void;
  addHeat: (amount: number) => void;
  coolHeat: (amount: number) => void;
  setWantedFromHeat: () => void;
  equipGear: (id: GearId) => void;
  unlockGear: (id: GearId) => void;
  useAmmo: (id: Exclude<GearId, "none">, n?: number) => boolean;
  unlockTransport: (t: TransportId) => void;
  enterNearestVehicle: () => boolean;
  exitVehicle: () => boolean;
  updateMountedVehiclePose: (pos: [number, number, number], facing: number) => void;
  setMapZoom: (z: number) => void;
  toggleMinimap: () => void;
}

export const DISTRICT_WORLD: Record<string, { x: number; z: number; name: string }> = {
  "town-market": { x: -3, z: 2.5, name: "Town Market" },
  "civic-centre": { x: 0, z: -1.5, name: "Civic Centre" },
  creekside: { x: -5.5, z: -3.5, name: "Creekside" },
  port: { x: 5.5, z: 2.5, name: "The Port" },
};

export const SAFEHOUSES: Safehouse[] = [
  { id: "sh-market", name: "Market back room", x: -4.8, z: 1.5, radius: 1.4, coolRate: 12 },
  { id: "sh-creek", name: "Creek jetty shed", x: -6.8, z: -4.2, radius: 1.5, coolRate: 16 },
  { id: "sh-civic", name: "Civic annex shade", x: 1.6, z: -2.6, radius: 1.3, coolRate: 10 },
];

/** Base speeds — refined by handling in the controller */
export const TRANSPORT_SPEED: Record<TransportId, number> = {
  foot: 4.2,
  bicycle: 6.8,
  scooter: 8.2,
  keke: 7.0,
  okada: 10.5,
  taxi: 8.5,
  ferry: 5.8,
};

export const TRANSPORT_LABEL: Record<TransportId, string> = {
  foot: "On foot",
  bicycle: "Bicycle",
  scooter: "Scooter",
  keke: "Keke",
  okada: "Okada",
  taxi: "Taxi",
  ferry: "Ferry",
};

/** Turn rate multiplier (higher = snappier) */
export const TRANSPORT_TURN: Record<TransportId, number> = {
  foot: 1,
  bicycle: 0.95,
  scooter: 1.05,
  keke: 0.75,
  okada: 1.1,
  taxi: 0.7,
  ferry: 0.45,
};

export const GEAR_LABEL: Record<GearId, string> = {
  none: "Unarmed",
  sidearm: "Sidearm",
  carbine: "Carbine",
  stun: "Stun tool",
};

const INITIAL_VEHICLES: WorldVehicle[] = [
  { id: "v-bike-1", kind: "bicycle", position: [-2.2, 0, 4.8], facing: 0.3, occupied: false },
  { id: "v-bike-2", kind: "bicycle", position: [1.5, 0, -0.5], facing: -0.8, occupied: false },
  { id: "v-scooter-1", kind: "scooter", position: [-1.0, 0, 5.0], facing: 0.1, occupied: false },
  { id: "v-scooter-2", kind: "scooter", position: [3.2, 0, 1.2], facing: 1.2, occupied: false },
  { id: "v-keke-1", kind: "keke", position: [2.0, 0, 4.6], facing: -0.4, occupied: false },
  { id: "v-keke-2", kind: "keke", position: [-0.5, 0, -2.2], facing: 0.6, occupied: false },
  { id: "v-okada-1", kind: "okada", position: [-1.5, 0, 5.2], facing: 0.2, occupied: false },
  { id: "v-okada-2", kind: "okada", position: [4.5, 0, 0.2], facing: -1.0, occupied: false },
  { id: "v-taxi-1", kind: "taxi", position: [2.2, 0, 5.0], facing: 0.0, occupied: false },
  { id: "v-taxi-2", kind: "taxi", position: [-3.5, 0, -0.3], facing: 1.5, occupied: false },
  { id: "v-ferry-1", kind: "ferry", position: [-6.0, 0.05, -4.6], facing: 0.5, occupied: false },
];

function heatToWanted(heat: number): number {
  if (heat <= 0) return 0;
  if (heat < 20) return 1;
  if (heat < 40) return 2;
  if (heat < 65) return 3;
  if (heat < 90) return 4;
  return 5;
}

export const useRoamStore = create<RoamState>((set, get) => ({
  mode: "orbit",
  transport: "foot",
  mountedVehicleId: null,
  position: [0, 0.6, 6],
  facing: 0,
  moveState: "idle",
  nearDistrictId: null,
  nearVehicleId: null,
  inSafehouseId: null,
  activeMission: null,
  missionLog: [],
  wantedLevel: 0,
  heatPoints: 0,
  gear: {
    equipped: "none",
    unlocked: ["none", "stun"],
    ammo: { sidearm: 0, carbine: 0, stun: 12 },
  },
  unlockedTransport: ["foot", "bicycle", "scooter", "keke", "okada", "taxi", "ferry"],
  mapZoom: 1,
  showMinimap: true,
  worldVehicles: INITIAL_VEHICLES.map((v) => ({ ...v })),

  setMode: (mode) => set({ mode }),
  setTransport: (transport) => {
    // Chip shortcut only when on foot — otherwise use enter/exit
    if (get().mountedVehicleId) return;
    if (!get().unlockedTransport.includes(transport)) {
      get().pushLog(`${TRANSPORT_LABEL[transport]} locked`);
      return;
    }
    set({ transport, mode: transport === "foot" ? get().mode : "walk" });
  },
  setPosition: (position) => set({ position }),
  setFacing: (facing) => set({ facing }),
  setMoveState: (moveState) => set({ moveState }),
  setNearDistrict: (nearDistrictId) => set({ nearDistrictId }),
  setNearVehicle: (nearVehicleId) => set({ nearVehicleId }),
  setInSafehouse: (inSafehouseId) => set({ inSafehouseId }),

  startMission: (mission) =>
    set({
      activeMission: mission,
      missionLog: [`Mission started: ${mission.title}`],
      mode: "walk",
      moveState: "ride",
    }),

  completeStep: (stepId) => {
    const mission = get().activeMission;
    if (!mission) return;
    const steps = mission.steps.map((s) => {
      if (s.id !== stepId) return s;
      if (!s.subSteps) return { ...s, done: true };
      const subs = s.subSteps.map((sub) => ({ ...sub, done: true }));
      return { ...s, done: true, subSteps: subs };
    });
    const allDone = steps.every((s) => s.done);
    set({
      activeMission: { ...mission, steps },
      missionLog: [
        allDone ? `Mission complete: ${mission.title}` : `Checkpoint: ${stepId}`,
        ...get().missionLog,
      ].slice(0, 10),
    });
  },

  completeSubStep: (stepId, subId) => {
    const mission = get().activeMission;
    if (!mission) return;
    const steps = mission.steps.map((s) => {
      if (s.id !== stepId || !s.subSteps) return s;
      const subSteps = s.subSteps.map((sub) =>
        sub.id === subId ? { ...sub, done: true } : sub,
      );
      const parentDone = subSteps.every((sub) => sub.done);
      return { ...s, subSteps, done: parentDone || s.done };
    });
    set({
      activeMission: { ...mission, steps },
      missionLog: [`Sub-objective done`, ...get().missionLog].slice(0, 10),
    });
  },

  clearMission: () => set({ activeMission: null }),

  pushLog: (line) => set({ missionLog: [line, ...get().missionLog].slice(0, 10) }),

  addHeat: (amount) => {
    const heatPoints = Math.min(100, get().heatPoints + amount);
    const wantedLevel = heatToWanted(heatPoints);
    set({ heatPoints, wantedLevel });
    if (wantedLevel > 0) get().pushLog(`Wanted level ${wantedLevel}`);
  },

  coolHeat: (amount) => {
    const heatPoints = Math.max(0, get().heatPoints - amount);
    set({ heatPoints, wantedLevel: heatToWanted(heatPoints) });
  },

  setWantedFromHeat: () => {
    set({ wantedLevel: heatToWanted(get().heatPoints) });
  },

  equipGear: (id) => {
    const { gear } = get();
    if (!gear.unlocked.includes(id)) return;
    set({ gear: { ...gear, equipped: id } });
    get().pushLog(`Equipped ${GEAR_LABEL[id]}`);
  },

  unlockGear: (id) => {
    const { gear } = get();
    if (gear.unlocked.includes(id)) return;
    const ammo = { ...gear.ammo };
    if (id !== "none" && ammo[id] === 0) ammo[id] = id === "stun" ? 12 : 24;
    set({
      gear: { ...gear, unlocked: [...gear.unlocked, id], ammo },
    });
    get().pushLog(`Unlocked ${GEAR_LABEL[id]}`);
  },

  useAmmo: (id, n = 1) => {
    const { gear } = get();
    if (gear.ammo[id] < n) return false;
    set({
      gear: {
        ...gear,
        ammo: { ...gear.ammo, [id]: gear.ammo[id] - n },
      },
    });
    return true;
  },

  unlockTransport: (t) => {
    if (get().unlockedTransport.includes(t)) return;
    set({ unlockedTransport: [...get().unlockedTransport, t] });
    get().pushLog(`Unlocked ${TRANSPORT_LABEL[t]}`);
  },

  enterNearestVehicle: () => {
    const { nearVehicleId, worldVehicles, unlockedTransport, mountedVehicleId } = get();
    if (mountedVehicleId) return false;
    if (!nearVehicleId) {
      get().pushLog("No vehicle nearby — walk closer");
      return false;
    }
    const v = worldVehicles.find((w) => w.id === nearVehicleId);
    if (!v || v.occupied) return false;
    if (!unlockedTransport.includes(v.kind)) {
      get().pushLog(`${TRANSPORT_LABEL[v.kind]} not unlocked`);
      return false;
    }
    if (v.kind === "ferry") {
      // Ferry only usable near water / creekside
      const [x, , z] = get().position;
      const creek = DISTRICT_WORLD["creekside"];
      if (!creek || Math.hypot(x - creek.x, z - creek.z) > 4.5) {
        get().pushLog("Ferry only at the creek");
        return false;
      }
    }
    set({
      worldVehicles: worldVehicles.map((w) =>
        w.id === v.id ? { ...w, occupied: true } : w,
      ),
      mountedVehicleId: v.id,
      transport: v.kind,
      position: [v.position[0], 0.6, v.position[2]],
      facing: v.facing,
      mode: "walk",
      moveState: "ride",
      missionLog: [`Entered ${TRANSPORT_LABEL[v.kind]}`, ...get().missionLog].slice(0, 10),
    });
    return true;
  },

  exitVehicle: () => {
    const { mountedVehicleId, worldVehicles, position, facing } = get();
    if (!mountedVehicleId) return false;
    set({
      worldVehicles: worldVehicles.map((w) =>
        w.id === mountedVehicleId
          ? {
              ...w,
              occupied: false,
              position: [position[0], w.kind === "ferry" ? 0.05 : 0, position[2]],
              facing,
            }
          : w,
      ),
      mountedVehicleId: null,
      transport: "foot",
      moveState: "idle",
      missionLog: [`Exited vehicle — on foot`, ...get().missionLog].slice(0, 10),
    });
    return true;
  },

  updateMountedVehiclePose: (pos, facing) => {
    const { mountedVehicleId, worldVehicles } = get();
    if (!mountedVehicleId) return;
    set({
      worldVehicles: worldVehicles.map((w) =>
        w.id === mountedVehicleId
          ? { ...w, position: [pos[0], w.position[1], pos[2]], facing }
          : w,
      ),
    });
  },

  setMapZoom: (mapZoom) => set({ mapZoom: Math.min(2, Math.max(0.6, mapZoom)) }),
  toggleMinimap: () => set({ showMinimap: !get().showMinimap }),
}));
