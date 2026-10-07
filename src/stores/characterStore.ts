import { create } from "zustand";

export type Gender = "female" | "male";
export type BodyShape = "slim" | "average" | "curvy" | "athletic" | "broad";
export type HeightId = "short" | "average" | "tall";
export type HairStyle = "short" | "afro" | "braids" | "bob" | "bun" | "long" | "bald";

export type ClothingSlot = "top" | "bottom" | "outer" | "shoes" | "accessory" | "hat";

export type ClothingItem = {
  id: string;
  name: string;
  slot: ClothingSlot;
  price: number;
  /** 0 = starter free */
  minLevel: number;
  color: string;
  color2?: string;
  gender: Gender | "any";
  blurb: string;
};

/** Everyone starts here — white tee + blue jeans */
export const STARTER_TOP = "top-white-tee";
export const STARTER_BOTTOM = "bottom-blue-jeans";
export const STARTER_SHOES = "shoes-basic";

export const CLOTHING_CATALOG: ClothingItem[] = [
  // Starters (free)
  {
    id: STARTER_TOP,
    name: "White T-shirt",
    slot: "top",
    price: 0,
    minLevel: 1,
    color: "#f8fafc",
    gender: "any",
    blurb: "Clean starter tee. Every new citizen gets one.",
  },
  {
    id: STARTER_BOTTOM,
    name: "Blue jeans",
    slot: "bottom",
    price: 0,
    minLevel: 1,
    color: "#2563eb",
    gender: "any",
    blurb: "Classic blue denim. Your first bottoms.",
  },
  {
    id: STARTER_SHOES,
    name: "Plain sneakers",
    slot: "shoes",
    price: 0,
    minLevel: 1,
    color: "#e5e7eb",
    gender: "any",
    blurb: "Simple kicks to walk the city.",
  },
  // Tops
  {
    id: "top-coral",
    name: "Coral crop tee",
    slot: "top",
    price: 180,
    minLevel: 2,
    color: "#fb7185",
    gender: "female",
    blurb: "Bright market energy.",
  },
  {
    id: "top-olive",
    name: "Olive button shirt",
    slot: "top",
    price: 220,
    minLevel: 2,
    color: "#4d7c0f",
    gender: "any",
    blurb: "Soft civic green.",
  },
  {
    id: "top-neon",
    name: "Neon lime turtleneck",
    slot: "top",
    price: 320,
    minLevel: 3,
    color: "#a3e635",
    gender: "any",
    blurb: "Night-city signal colour.",
  },
  {
    id: "top-ankara",
    name: "Ankara print top",
    slot: "top",
    price: 280,
    minLevel: 3,
    color: "#e11d48",
    color2: "#fbbf24",
    gender: "any",
    blurb: "Yard print energy from Town Market.",
  },
  // Bottoms
  {
    id: "bottom-white-wide",
    name: "Wide white pants",
    slot: "bottom",
    price: 200,
    minLevel: 2,
    color: "#f5f5f4",
    gender: "any",
    blurb: "Flow for long walks.",
  },
  {
    id: "bottom-cargo",
    name: "Olive cargos",
    slot: "bottom",
    price: 240,
    minLevel: 3,
    color: "#3f6212",
    gender: "any",
    blurb: "Pockets for the whole district.",
  },
  {
    id: "bottom-skirt",
    name: "Denim mini",
    slot: "bottom",
    price: 210,
    minLevel: 2,
    color: "#60a5fa",
    gender: "female",
    blurb: "Light for hot PH afternoons.",
  },
  // Outers
  {
    id: "outer-pink-fur",
    name: "Pink statement coat",
    slot: "outer",
    price: 520,
    minLevel: 4,
    color: "#fb7185",
    color2: "#f472b6",
    gender: "female",
    blurb: "Volume coat — advanced drip.",
  },
  {
    id: "outer-coral-coat",
    name: "Coral oversized coat",
    slot: "outer",
    price: 480,
    minLevel: 4,
    color: "#f97316",
    color2: "#a855f7",
    gender: "any",
    blurb: "Big shoulders, bigger presence.",
  },
  {
    id: "outer-grey-crew",
    name: "Grey crew pullover",
    slot: "outer",
    price: 260,
    minLevel: 2,
    color: "#6b7280",
    gender: "any",
    blurb: "Quiet street layer.",
  },
  // Hats
  {
    id: "hat-beanie-green",
    name: "Forest beanie",
    slot: "hat",
    price: 120,
    minLevel: 2,
    color: "#166534",
    gender: "any",
    blurb: "Warm for harmattan evenings.",
  },
  {
    id: "hat-bucket",
    name: "Check bucket hat",
    slot: "hat",
    price: 150,
    minLevel: 3,
    color: "#86efac",
    gender: "any",
    blurb: "Shade + style.",
  },
  {
    id: "hat-wide",
    name: "Wide brim hat",
    slot: "hat",
    price: 190,
    minLevel: 3,
    color: "#fafaf9",
    gender: "any",
    blurb: "Sun protection, main-character energy.",
  },
  // Accessories
  {
    id: "acc-shades",
    name: "Sunset shades",
    slot: "accessory",
    price: 140,
    minLevel: 2,
    color: "#1a1a1a",
    gender: "any",
    blurb: "Block the glare on Aba Road.",
  },
  {
    id: "acc-glasses",
    name: "Clear frames",
    slot: "accessory",
    price: 110,
    minLevel: 2,
    color: "#e2e8f0",
    gender: "any",
    blurb: "Soft civic look.",
  },
  {
    id: "acc-hoops",
    name: "Gold hoops",
    slot: "accessory",
    price: 160,
    minLevel: 2,
    color: "#fbbf24",
    gender: "female",
    blurb: "Classic shine.",
  },
  {
    id: "acc-chain",
    name: "Silver chain",
    slot: "accessory",
    price: 200,
    minLevel: 3,
    color: "#e5e7eb",
    gender: "any",
    blurb: "Subtle flex.",
  },
  // Shoes
  {
    id: "shoes-red",
    name: "Red sneakers",
    slot: "shoes",
    price: 180,
    minLevel: 2,
    color: "#ef4444",
    gender: "any",
    blurb: "Move loud.",
  },
  {
    id: "shoes-boots",
    name: "Denim boots",
    slot: "shoes",
    price: 300,
    minLevel: 4,
    color: "#3b82f6",
    gender: "female",
    blurb: "Statement footwear.",
  },
];

export type EquippedLoadout = {
  top: string;
  bottom: string;
  outer: string | null;
  shoes: string;
  accessory: string | null;
  hat: string | null;
};

export type CharacterAppearance = {
  gender: Gender;
  bodyShape: BodyShape;
  height: HeightId;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  displayName: string;
};

const DEFAULT_APPEARANCE: CharacterAppearance = {
  gender: "female",
  bodyShape: "average",
  height: "average",
  skin: "#8d5524",
  hair: "braids",
  hairColor: "#1a1a1a",
  displayName: "Citizen",
};

const DEFAULT_EQUIPPED: EquippedLoadout = {
  top: STARTER_TOP,
  bottom: STARTER_BOTTOM,
  outer: null,
  shoes: STARTER_SHOES,
  accessory: null,
  hat: null,
};

const STARTER_OWNED = [STARTER_TOP, STARTER_BOTTOM, STARTER_SHOES];

interface CharacterState {
  appearance: CharacterAppearance;
  equipped: EquippedLoadout;
  owned: string[];
  setGender: (g: Gender) => void;
  setBodyShape: (s: BodyShape) => void;
  setHeight: (h: HeightId) => void;
  setSkin: (hex: string) => void;
  setHair: (h: HairStyle) => void;
  setHairColor: (hex: string) => void;
  setDisplayName: (n: string) => void;
  equip: (itemId: string) => void;
  unequipSlot: (slot: ClothingSlot) => void;
  ownItem: (itemId: string) => void;
  owns: (itemId: string) => boolean;
  canWear: (item: ClothingItem) => boolean;
  resetToStarter: () => void;
  hydrate: () => void;
  persist: () => void;
}

function save(state: {
  appearance: CharacterAppearance;
  equipped: EquippedLoadout;
  owned: string[];
}) {
  try {
    localStorage.setItem("am-character-v2", JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  appearance: { ...DEFAULT_APPEARANCE },
  equipped: { ...DEFAULT_EQUIPPED },
  owned: [...STARTER_OWNED],

  setGender: (gender) => {
    set({ appearance: { ...get().appearance, gender } });
    get().persist();
  },
  setBodyShape: (bodyShape) => {
    set({ appearance: { ...get().appearance, bodyShape } });
    get().persist();
  },
  setHeight: (height) => {
    set({ appearance: { ...get().appearance, height } });
    get().persist();
  },
  setSkin: (skin) => {
    set({ appearance: { ...get().appearance, skin } });
    get().persist();
  },
  setHair: (hair) => {
    set({ appearance: { ...get().appearance, hair } });
    get().persist();
  },
  setHairColor: (hairColor) => {
    set({ appearance: { ...get().appearance, hairColor } });
    get().persist();
  },
  setDisplayName: (displayName) => {
    set({ appearance: { ...get().appearance, displayName } });
    get().persist();
  },

  equip: (itemId) => {
    const item = CLOTHING_CATALOG.find((c) => c.id === itemId);
    if (!item || !get().owns(itemId)) return;
    if (!get().canWear(item)) return;
    const equipped = { ...get().equipped };
    if (item.slot === "top") equipped.top = itemId;
    if (item.slot === "bottom") equipped.bottom = itemId;
    if (item.slot === "outer") equipped.outer = itemId;
    if (item.slot === "shoes") equipped.shoes = itemId;
    if (item.slot === "accessory") equipped.accessory = itemId;
    if (item.slot === "hat") equipped.hat = itemId;
    set({ equipped });
    get().persist();
  },

  unequipSlot: (slot) => {
    const equipped = { ...get().equipped };
    if (slot === "outer") equipped.outer = null;
    if (slot === "accessory") equipped.accessory = null;
    if (slot === "hat") equipped.hat = null;
    if (slot === "top") equipped.top = STARTER_TOP;
    if (slot === "bottom") equipped.bottom = STARTER_BOTTOM;
    if (slot === "shoes") equipped.shoes = STARTER_SHOES;
    set({ equipped });
    get().persist();
  },

  ownItem: (itemId) => {
    if (get().owned.includes(itemId)) return;
    set({ owned: [...get().owned, itemId] });
    get().persist();
  },

  owns: (itemId) => get().owned.includes(itemId),

  canWear: (item) => {
    const g = get().appearance.gender;
    return item.gender === "any" || item.gender === g;
  },

  resetToStarter: () => {
    set({
      equipped: { ...DEFAULT_EQUIPPED },
      owned: [...STARTER_OWNED],
    });
    get().persist();
  },

  hydrate: () => {
    try {
      const raw = localStorage.getItem("am-character-v2");
      if (!raw) return;
      const data = JSON.parse(raw) as {
        appearance?: CharacterAppearance;
        equipped?: EquippedLoadout;
        owned?: string[];
      };
      set({
        appearance: { ...DEFAULT_APPEARANCE, ...data.appearance },
        equipped: { ...DEFAULT_EQUIPPED, ...data.equipped },
        owned: data.owned?.length ? data.owned : [...STARTER_OWNED],
      });
    } catch {
      /* ignore */
    }
  },

  persist: () => {
    const { appearance, equipped, owned } = get();
    save({ appearance, equipped, owned });
  },
}));

export const SKIN_TONES = [
  "#5c3317",
  "#8d5524",
  "#a0673f",
  "#c68642",
  "#d4a574",
  "#e0b890",
];

export const BODY_SHAPE_LABEL: Record<BodyShape, string> = {
  slim: "Slim",
  average: "Average",
  curvy: "Curvy",
  athletic: "Athletic",
  broad: "Broad",
};

/** @deprecated keep export name for older imports */
export const CHARACTER_PRESETS = [];
export function hydrateCharacterStore() {
  useCharacterStore.getState().hydrate();
}
