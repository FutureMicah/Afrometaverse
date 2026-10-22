import { create } from "zustand";
import { useRoamStore } from "@/stores/roamStore";
import { INTERIORS } from "@/data/interiors";

/** Which building interior the player is currently inside (null = street). */
export type InteriorId = "safehouse" | "market-shop" | "workplace";

interface InteriorState {
  insideId: InteriorId | null;
  /** Door the player is standing at (set by the city, read by the HUD/touch button). */
  nearDoorId: InteriorId | null;
  /** Where the player stood outside, so exit returns to the same spot. */
  exitPos: { x: number; z: number; rotY: number } | null;
  setNearDoor: (id: InteriorId | null) => void;
  enterInterior: (id: InteriorId, from: { x: number; z: number; rotY: number }) => boolean;
  exitInterior: () => { x: number; z: number; rotY: number } | null;
}

export const useInteriorStore = create<InteriorState>((set, get) => ({
  insideId: null,
  nearDoorId: null,
  exitPos: null,
  setNearDoor: (nearDoorId) => {
    if (get().nearDoorId !== nearDoorId) set({ nearDoorId });
  },
  enterInterior: (id, from) => {
    if (get().insideId) return false;
    set({ insideId: id, exitPos: { ...from }, nearDoorId: null });
    return true;
  },
  exitInterior: () => {
    const pos = get().exitPos;
    set({ insideId: null, exitPos: null });
    return pos;
  },
}));

/** Teleport the player into a building; remember the street spot so exit returns to it. */
export function enterBuilding(id: InteriorId): boolean {
  const roam = useRoamStore.getState();
  const [x, , z] = roam.position;
  const ok = useInteriorStore.getState().enterInterior(id, { x, z, rotY: roam.facing });
  if (ok) roam.setPosition([INTERIORS[id].action.x, 0.6, INTERIORS[id].action.z + 1.2]);
  return ok;
}
