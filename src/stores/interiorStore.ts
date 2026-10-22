import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useRoamStore } from "@/stores/roamStore";
import { INTERIORS } from "@/data/interiors";
import { DECOR_CATALOG, getDecorItem, type DecorItem } from "@/data/decor";
import { checkPlacement, firstFreeSpot, snap, type Placement, type PlaceRefusal } from "@/lib/hutGrid";
import {
  apertureActions,
  defaultApertures,
  stepApertures,
  stepWetness,
  openFraction,
  windStrength,
  type ApertureAction,
  type RoomApertures,
} from "@/lib/interiorWeather";

/** Which building interior the player is currently inside (null = street). */
export type InteriorId = "safehouse" | "market-shop" | "workplace";

/** Only the family compound hut can be decorated (spec 18 scope for this batch). */
export const DECORABLE_ID: InteriorId = "safehouse";

export type ApertureName = "door" | "shutter";

interface InteriorState {
  insideId: InteriorId | null;
  /** Door the player is standing at (set by the city, read by the HUD/touch button). */
  nearDoorId: InteriorId | null;
  /** Where the player stood outside, so exit returns to the same spot. */
  exitPos: { x: number; z: number; rotY: number } | null;

  // Interior weather (spec 17). Per session, not persisted.
  apertures: RoomApertures;
  /** Floor wetness 0 to 1 from rain blowing in. */
  wetness: number;
  /** Count of blow-open events this session (drives the clack sound). */
  blowOpenCount: number;

  // Decoration (spec 18). Persisted per browser.
  /** Owned, unplaced items by catalog id. */
  decorInventory: Record<string, number>;
  /** Items placed in the compound hut. */
  decorPlacements: Placement[];

  setNearDoor: (id: InteriorId | null) => void;
  enterInterior: (id: InteriorId, from: { x: number; z: number; rotY: number }) => boolean;
  exitInterior: () => { x: number; z: number; rotY: number } | null;

  applyAperture: (name: ApertureName, action: ApertureAction) => void;
  /** One weather step: wind on apertures, rain in, wetness. Called each frame inside the room. */
  tickInteriorWeather: (args: { dt: number; windSpeed: number; rainIntensity: number; roll: () => number }) => void;

  grantDecor: (itemId: string, count?: number) => boolean;
  placeDecor: (itemId: string, x: number, z: number, rot: number) => PlaceRefusal | null;
  autoPlaceDecor: (itemId: string, rot?: number) => PlaceRefusal | null;
  rotateDecor: (uid: string) => PlaceRefusal | null;
  pickupDecor: (uid: string) => boolean;
}

let uidCounter = 0;
function newUid(): string {
  uidCounter += 1;
  return `pl-${Date.now().toString(36)}-${uidCounter}`;
}

export const useInteriorStore = create<InteriorState>()(
  persist(
    (set, get) => ({
      insideId: null,
      nearDoorId: null,
      exitPos: null,
      apertures: defaultApertures(),
      wetness: 0,
      blowOpenCount: 0,
      decorInventory: {},
      decorPlacements: [],

      setNearDoor: (nearDoorId) => {
        if (get().nearDoorId !== nearDoorId) set({ nearDoorId });
      },
      enterInterior: (id, from) => {
        if (get().insideId) return false;
        set({
          insideId: id,
          exitPos: { ...from },
          nearDoorId: null,
          apertures: defaultApertures(),
          wetness: 0,
          blowOpenCount: 0,
        });
        return true;
      },
      exitInterior: () => {
        const pos = get().exitPos;
        set({ insideId: null, exitPos: null });
        return pos;
      },

      applyAperture: (name, action) => {
        const cur = get().apertures;
        const a = cur[name];
        const next = action === "open" ? apertureActions.open() : apertureActions[action](a);
        set({ apertures: { ...cur, [name]: next } });
      },

      tickInteriorWeather: ({ dt, windSpeed, rainIntensity, roll }) => {
        const { apertures, wetness, blowOpenCount } = get();
        const strength = windStrength(windSpeed);
        const list = [apertures.door, apertures.shutter] as const;
        const step = stepApertures([...list], strength, dt, roll);
        const nextApertures: RoomApertures = {
          door: step.apertures[0] ?? apertures.door,
          shutter: step.apertures[1] ?? apertures.shutter,
        };
        const openFrac = openFraction(step.apertures);
        set({
          apertures: nextApertures,
          wetness: stepWetness(wetness, rainIntensity, openFrac, dt),
          blowOpenCount: blowOpenCount + step.blownOpen.length,
        });
      },

      grantDecor: (itemId, count = 1) => {
        if (!DECOR_CATALOG[itemId] || count <= 0) return false;
        const inv = get().decorInventory;
        set({ decorInventory: { ...inv, [itemId]: (inv[itemId] ?? 0) + count } });
        return true;
      },

      placeDecor: (itemId, x, z, rot) => {
        const item = getDecorItem(itemId);
        if (!item) return "overlap";
        const { decorInventory, decorPlacements } = get();
        if ((decorInventory[itemId] ?? 0) < 1) return "overlap";
        const sx = snap(x);
        const sz = snap(z);
        const refusal = checkPlacement(item, sx, sz, rot, decorPlacements, DECOR_CATALOG);
        if (refusal) return refusal;
        set({
          decorInventory: takeOne(decorInventory, itemId),
          decorPlacements: [...decorPlacements, { uid: newUid(), itemId, x: sx, z: sz, rot }],
        });
        return null;
      },

      autoPlaceDecor: (itemId, rot = 0) => {
        const item = getDecorItem(itemId);
        if (!item) return "overlap";
        const { decorInventory, decorPlacements } = get();
        if ((decorInventory[itemId] ?? 0) < 1) return "overlap";
        const spot = firstFreeSpot(item, rot, decorPlacements, DECOR_CATALOG);
        if (!spot) return "overlap";
        return get().placeDecor(itemId, spot.x, spot.z, rot);
      },

      rotateDecor: (uid) => {
        const { decorPlacements } = get();
        const p = decorPlacements.find((q) => q.uid === uid);
        if (!p) return "overlap";
        const item = DECOR_CATALOG[p.itemId] as DecorItem | undefined;
        if (!item) return "overlap";
        const rot = (p.rot + 1) % 4;
        const refusal = checkPlacement(item, p.x, p.z, rot, decorPlacements, DECOR_CATALOG, uid);
        if (refusal) return refusal;
        set({ decorPlacements: decorPlacements.map((q) => (q.uid === uid ? { ...q, rot } : q)) });
        return null;
      },

      pickupDecor: (uid) => {
        const { decorPlacements, decorInventory } = get();
        const p = decorPlacements.find((q) => q.uid === uid);
        if (!p) return false;
        set({
          decorPlacements: decorPlacements.filter((q) => q.uid !== uid),
          decorInventory: { ...decorInventory, [p.itemId]: (decorInventory[p.itemId] ?? 0) + 1 },
        });
        return true;
      },
    }),
    {
      name: "afrometaverse.interiorDecor.v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({ decorInventory: s.decorInventory, decorPlacements: s.decorPlacements }),
    },
  ),
);

function takeOne(inv: Record<string, number>, itemId: string): Record<string, number> {
  const left = (inv[itemId] ?? 0) - 1;
  const next = { ...inv };
  if (left <= 0) delete next[itemId];
  else next[itemId] = left;
  return next;
}

/** Teleport the player into a building; remember the street spot so exit returns to it. */
export function enterBuilding(id: InteriorId): boolean {
  const roam = useRoamStore.getState();
  const [x, , z] = roam.position;
  const ok = useInteriorStore.getState().enterInterior(id, { x, z, rotY: roam.facing });
  if (ok) roam.setPosition([INTERIORS[id].action.x, 0.6, INTERIORS[id].action.z + 1.2]);
  return ok;
}
