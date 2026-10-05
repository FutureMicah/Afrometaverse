import { create } from "zustand";

export type RoamMode = "orbit" | "walk" | "ride";
export type TransportId = "foot" | "okada" | "taxi" | "ferry";

export type MissionStep = {
  id: string;
  label: string;
  districtId: string;
  done: boolean;
};

export type ActiveMission = {
  jobId: string;
  title: string;
  reward: number;
  rep: number;
  steps: MissionStep[];
  startedAt: number;
} | null;

interface RoamState {
  mode: RoamMode;
  transport: TransportId;
  position: [number, number, number];
  facing: number; // radians yaw
  nearDistrictId: string | null;
  activeMission: ActiveMission;
  missionLog: string[];
  setMode: (mode: RoamMode) => void;
  setTransport: (t: TransportId) => void;
  setPosition: (pos: [number, number, number]) => void;
  setFacing: (yaw: number) => void;
  setNearDistrict: (id: string | null) => void;
  startMission: (mission: NonNullable<ActiveMission>) => void;
  completeStep: (stepId: string) => void;
  clearMission: () => void;
  pushLog: (line: string) => void;
}

/** Approximate world positions matching DISTRICT_LAYOUT in the scene */
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

export const useRoamStore = create<RoamState>((set, get) => ({
  mode: "orbit",
  transport: "foot",
  position: [0, 0.6, 6],
  facing: 0,
  nearDistrictId: null,
  activeMission: null,
  missionLog: [],

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
    const steps = mission.steps.map((s) => (s.id === stepId ? { ...s, done: true } : s));
    const allDone = steps.every((s) => s.done);
    set({
      activeMission: { ...mission, steps },
      missionLog: [
        ...(allDone
          ? [`Mission complete: ${mission.title}`]
          : [`Checkpoint reached`]),
        ...get().missionLog,
      ].slice(0, 8),
    });
  },

  clearMission: () => set({ activeMission: null }),

  pushLog: (line) => set({ missionLog: [line, ...get().missionLog].slice(0, 8) }),
}));
