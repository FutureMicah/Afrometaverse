import { create } from "zustand";

export type BodyBuild = "slim" | "average" | "broad";
export type HairStyle = "short" | "afro" | "braids" | "bob" | "bun" | "beanie";
export type OutfitId =
  | "street-grey"
  | "coral-coat"
  | "olive-blazer"
  | "neon-lime"
  | "pink-fur"
  | "family-dad"
  | "market-chic"
  | "creek-casual";

export type CharacterPreset = {
  id: string;
  name: string;
  skin: string;
  build: BodyBuild;
  hair: HairStyle;
  hairColor: string;
  outfit: OutfitId;
  accessory?: "glasses" | "shades" | "hoops" | "chain" | "none";
};

/** Fashion-forward PH / diaspora citizen presets inspired by style refs */
export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: "ekene",
    name: "Ekene",
    skin: "#8d5524",
    build: "average",
    hair: "short",
    hairColor: "#1a1a1a",
    outfit: "street-grey",
    accessory: "glasses",
  },
  {
    id: "ada",
    name: "Ada",
    skin: "#c68642",
    build: "slim",
    hair: "bob",
    hairColor: "#1a1a1a",
    outfit: "olive-blazer",
    accessory: "shades",
  },
  {
    id: "chioma",
    name: "Chioma",
    skin: "#a0673f",
    build: "slim",
    hair: "braids",
    hairColor: "#3b2f2f",
    outfit: "market-chic",
    accessory: "hoops",
  },
  {
    id: "tunde",
    name: "Tunde",
    skin: "#5c3317",
    build: "broad",
    hair: "beanie",
    hairColor: "#1e3a2f",
    outfit: "coral-coat",
    accessory: "chain",
  },
  {
    id: "zara",
    name: "Zara",
    skin: "#b57845",
    build: "average",
    hair: "afro",
    hairColor: "#4a3728",
    outfit: "pink-fur",
    accessory: "shades",
  },
  {
    id: "kemi",
    name: "Kemi",
    skin: "#d4a574",
    build: "slim",
    hair: "bun",
    hairColor: "#2c1810",
    outfit: "creek-casual",
    accessory: "hoops",
  },
  {
    id: "neon",
    name: "Seyi",
    skin: "#8d5524",
    build: "slim",
    hair: "beanie",
    hairColor: "#a3e635",
    outfit: "neon-lime",
    accessory: "glasses",
  },
  {
    id: "papa",
    name: "Papa Obi",
    skin: "#6b4423",
    build: "broad",
    hair: "short",
    hairColor: "#c4c4c4",
    outfit: "family-dad",
    accessory: "glasses",
  },
];

export const OUTFIT_COLORS: Record<
  OutfitId,
  { primary: string; secondary: string; accent: string }
> = {
  "street-grey": { primary: "#6b7280", secondary: "#374151", accent: "#e5e7eb" },
  "coral-coat": { primary: "#f97316", secondary: "#a855f7", accent: "#fdba74" },
  "olive-blazer": { primary: "#4d7c0f", secondary: "#f5f5f4", accent: "#a3e635" },
  "neon-lime": { primary: "#a3e635", secondary: "#1a1a1a", accent: "#ecfccb" },
  "pink-fur": { primary: "#fb7185", secondary: "#f472b6", accent: "#ffe4e6" },
  "family-dad": { primary: "#93c5fd", secondary: "#f5f5f4", accent: "#1e3a5f" },
  "market-chic": { primary: "#e11d48", secondary: "#fef3c7", accent: "#fb7185" },
  "creek-casual": { primary: "#e2e8f0", secondary: "#94a3b8", accent: "#38bdf8" },
};

interface CharacterState {
  presetId: string;
  setPreset: (id: string) => void;
  getPreset: () => CharacterPreset;
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  presetId: "ekene",
  setPreset: (presetId) => {
    set({ presetId });
    try {
      localStorage.setItem("am-character-v1", presetId);
    } catch {
      /* ignore */
    }
  },
  getPreset: () => {
    const id = get().presetId;
    return CHARACTER_PRESETS.find((p) => p.id === id) ?? CHARACTER_PRESETS[0];
  },
}));

/** Load saved character once on client */
export function hydrateCharacterStore() {
  try {
    const id = localStorage.getItem("am-character-v1");
    if (id && CHARACTER_PRESETS.some((p) => p.id === id)) {
      useCharacterStore.setState({ presetId: id });
    }
  } catch {
    /* ignore */
  }
}
