import { create } from "zustand";

export type RoamMode = "orbit" | "walk" | "ride";
export type TransportId = "foot" | "okada" | "taxi" | "ferry";

/** Abstract in-game tools only — not real-world firearm designs. */
export type GearId = "none" | "sidearm" | "carbine" | "stun";

export type MissionKind = "legal" | "grey" | "heat";

export type MissionStep = {
  id: string;
  label: string;
  districtId: string;
  done: boolean;
  /** Optional nested sub-objectives under this step */
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

interface RoamState {
  mode: RoamMode;
  transport: TransportId;
  position: [number, number, number];
  facing: number;
  nearDistrictId: string | null;
  activeMission: ActiveMission;
  missionLog: string[];
  /** 0–5 stars, GTA-style heat */
  wantedLevel: number;
  heatPoints: number;
  gear: GearLoadout;
  mapZoom: number;
  showMinimap: boolean;

  setMode: (mode: RoamMode) => void;
  setTransport: (t: TransportId) => void;
  setPosition: (pos: [number, number, number]) => void;
  setFacing: (yaw: number) => void;
  setNearDistrict: (id: string | null) => void;
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
  setMapZoom: (z: number) => void;
  toggleMinimap: () => void;
}

export const DISTRICT_WORLD: Record<string, { x: number; z: number; name: string }> = {
  "town-market": { x: -3, z: 2.5, name: "Town Market" },
  "civic-centre": { x: 0, z: -1.5, name: "Civic Centre" },
  creekside: { x: -5.5, z: -3.5, name: "Creekside" },
  port: { x: 5.5, z: 2.5, name: "The Port" },
};

export const TRANSPORT_SPEED: Record<TransportId, number> = {
  foot: 4.2,
  okada: 9.5,
  taxi: 7.5,
  ferry: 5.5,
};

export const GEAR_LABEL: Record<GearId, string> = {
  none: "Unarmed",
  sidearm: "Sidearm",
  carbine: "Carbine",
  stun: "Stun tool",
};

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
  position: [0, 0.6, 6],
  facing: 0,
  nearDistrictId: null,
  activeMission: null,
  missionLog: [],
  wantedLevel: 0,
  heatPoints: 0,
  gear: {
    equipped: "none",
    unlocked: ["none", "stun"],
    ammo: { sidearm: 0, carbine: 0, stun: 12 },
  },
  mapZoom: 1,
  showMinimap: true,

  setMode: (mode) => set({ mode }),
  setTransport: (transport) => set({ transport }),
  setPosition: (position) => set({ position }),
  setFacing: (facing) => set({ facing }),
  setNearDistrict: (nearDistrictId) => set({ nearDistrictId }),

  startMission: (mission) =>
    set({
      activeMission: mission,
      missionLog: [`Mission started: ${mission.title}`],
      mode: "walk",
    }),

  completeStep: (stepId) => {
    const mission = get().activeMission;
    if (!mission) return;
    const steps = mission.steps.map((s) => {
      if (s.id !== stepId) return s;
      const subs = s.subSteps?.map((sub) => ({ ...sub, done: true }));
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
    if (wantedLevel > get().wantedLevel) {
      get().pushLog(`Wanted level ${wantedLevel}`);
    }
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

  setMapZoom: (mapZoom) => set({ mapZoom: Math.min(2, Math.max(0.6, mapZoom)) }),
  toggleMinimap: () => set({ showMinimap: !get().showMinimap }),
}));
