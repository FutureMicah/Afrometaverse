import type { InteriorId } from "@/stores/interiorStore";

/**
 * Interior definitions for the three enterable buildings.
 * Each door sits on the outside of its building and the exit spot is in front of it,
 * so leaving the room puts the player back on the street at the same door.
 */
export interface InteriorDef {
  id: InteriorId;
  name: string;
  /** Door location in the city (where the player walks up to enter). */
  door: { x: number; z: number };
  /** Spot just outside the door where the player reappears on exit. */
  street: { x: number; z: number; rotY: number };
  /** Interaction spot inside, in interior local coordinates. */
  action: { x: number; z: number; label: string };
  /** Short description shown in the interior HUD. */
  blurb: string;
}

export const INTERIORS: Record<InteriorId, InteriorDef> = {
  safehouse: {
    id: "safehouse",
    name: "Family compound hut",
    door: { x: -4.8, z: 1.5 },
    street: { x: -4.8, z: 2.4, rotY: Math.PI },
    action: { x: 0, z: -2.2, label: "Rest by the hearth" },
    blurb: "Family compound hut. Sit by the hearth and cool down to drop heat.",
  },
  "market-shop": {
    id: "market-shop",
    name: "Market trade hut",
    /** Separated from residential compounds — northeast market quarter */
    door: { x: 18.0, z: 19.2 },
    street: { x: 18.0, z: 20.3, rotY: Math.PI },
    action: { x: 0, z: -2.0, label: "Trader's mat" },
    blurb: "Market trade hut. Goods on woven mats — trade with cowries and kowry shells."
  },
  workplace: {
    id: "workplace",
    name: "Craft work hut",
    door: { x: 5.5, z: 4.4 },
    street: { x: 5.5, z: 5.2, rotY: Math.PI },
    action: { x: 0, z: -2.0, label: "Carver's bench" },
    blurb: "Craft work hut. Carve and shape timber — earn cowries for steady hands."
  },
};

export const INTERIOR_LIST: InteriorDef[] = Object.values(INTERIORS);

/** Distance (metres) within which the door prompt shows and entry is allowed. */
export const DOOR_RADIUS = 1.4;
