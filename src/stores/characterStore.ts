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

  {
    id: "top-black-tee",
    name: "Black essential tee",
    slot: "top",
    price: 90,
    minLevel: 1,
    color: "#1f2937",
    gender: "any",
    blurb: "Simple black — first upgrade from white.",
  },
  {
    id: "bottom-black-jeans",
    name: "Black jeans",
    slot: "bottom",
    price: 150,
    minLevel: 2,
    color: "#111827",
    gender: "any",
    blurb: "Night-ready denim.",
  },
  {
    id: "outer-denim-jacket",
    name: "Denim jacket",
    slot: "outer",
    price: 340,
    minLevel: 3,
    color: "#3b82f6",
    gender: "any",
    blurb: "Layer for creek breeze.",
  },
  {
    id: "acc-watch",
    name: "City watch",
    slot: "accessory",
    price: 250,
    minLevel: 3,
    color: "#94a3b8",
    gender: "any",
    blurb: "Know the district hour.",
  },
  {
    id: "hat-cap",
    name: "Dad cap",
    slot: "hat",
    price: 100,
    minLevel: 1,
    color: "#0f172a",
    gender: "any",
    blurb: "Everyday shade.",
  },
  {
    id: "shoes-white-fresh",
    name: "Fresh white kicks",
    slot: "shoes",
    price: 220,
    minLevel: 2,
    color: "#ffffff",
    gender: "any",
    blurb: "Keep them clean on laterite.",
  },
];


/** Tailor / fabric metadata — every piece has specific construction notes */
export type FabricKind =
  | "cotton"
  | "denim"
  | "wool"
  | "poly"
  | "ankara"
  | "fleece"
  | "leather"
  | "metal"
  | "mesh";

export type StitchQuality = "home" | "market" | "atelier" | "luxury";

export type GarmentDetail = {
  fabric: FabricKind;
  stitch: StitchQuality;
  /** Wear 0 fresh → 1 heavily worn */
  wear: number;
  /** Unique tailor notes */
  notes: string;
  /** Thread colour for visible stitching */
  threadColor: string;
  buttons?: string;
  /** Asymmetric feature */
  quirk?: string;
};

export const GARMENT_DETAILS: Record<string, GarmentDetail> = {
  "top-white-tee": {
    fabric: "cotton",
    stitch: "market",
    wear: 0.15,
    notes: "Single-needle hem, slightly uneven left sleeve (batch 12).",
    threadColor: "#e5e7eb",
    quirk: "Tiny ink mark inside collar",
  },
  "bottom-blue-jeans": {
    fabric: "denim",
    stitch: "market",
    wear: 0.25,
    notes: "Copper rivets, right-pocket thread already fuzzing.",
    threadColor: "#1e3a8a",
    buttons: "#a8a29e",
    quirk: "Back-right belt loop looser than the rest",
  },
  "shoes-basic": {
    fabric: "poly",
    stitch: "home",
    wear: 0.3,
    notes: "Molded sole, lace tips slightly crushed.",
    threadColor: "#fafaf9",
    quirk: "Left shoe crease deeper",
  },
  "top-black-tee": {
    fabric: "cotton",
    stitch: "market",
    wear: 0.05,
    notes: "Reactive black dye, collar still stiff.",
    threadColor: "#111827",
  },
  "bottom-black-jeans": {
    fabric: "denim",
    stitch: "atelier",
    wear: 0.1,
    notes: "Black over-dye denim, clean chain-stitch hem.",
    threadColor: "#0f172a",
    buttons: "#52525b",
  },
  "top-coral": {
    fabric: "cotton",
    stitch: "atelier",
    wear: 0.05,
    notes: "Cropped rib, side vents hand-finished.",
    threadColor: "#fb7185",
  },
  "top-olive": {
    fabric: "cotton",
    stitch: "atelier",
    wear: 0.08,
    notes: "Mother-of-pearl buttons, one spare sewn inside placket.",
    threadColor: "#365314",
    buttons: "#f5f5f4",
    quirk: "Second button sits 2mm high",
  },
  "top-neon": {
    fabric: "poly",
    stitch: "market",
    wear: 0.02,
    notes: "High-vis knit, heat-set collar.",
    threadColor: "#a3e635",
  },
  "top-ankara": {
    fabric: "ankara",
    stitch: "atelier",
    wear: 0.1,
    notes: "Wax print matched at side seam; pattern centres on chest.",
    threadColor: "#fbbf24",
    quirk: "One motif upside-down near hem — intentional",
  },
  "bottom-white-wide": {
    fabric: "cotton",
    stitch: "atelier",
    wear: 0.05,
    notes: "Wide leg, pressed crease, clean overlock.",
    threadColor: "#f5f5f4",
  },
  "bottom-cargo": {
    fabric: "cotton",
    stitch: "market",
    wear: 0.2,
    notes: "Six pockets, bar-tacks on stress points.",
    threadColor: "#3f6212",
    quirk: "Left cargo flap snaps tighter",
  },
  "bottom-skirt": {
    fabric: "denim",
    stitch: "atelier",
    wear: 0.12,
    notes: "Mini length, contrast topstitch.",
    threadColor: "#93c5fd",
  },
  "outer-pink-fur": {
    fabric: "fleece",
    stitch: "luxury",
    wear: 0.05,
    notes: "Faux shearling, bound seams, heavy.",
    threadColor: "#f472b6",
    quirk: "One longer guard hair cluster on right cuff",
  },
  "outer-coral-coat": {
    fabric: "wool",
    stitch: "luxury",
    wear: 0.08,
    notes: "Structured shoulder pads, covered buttons.",
    threadColor: "#fdba74",
    buttons: "#9a3412",
    quirk: "Left lapel rolls softer",
  },
  "outer-grey-crew": {
    fabric: "cotton",
    stitch: "market",
    wear: 0.18,
    notes: "Midweight fleece, rib cuffs already pill slightly.",
    threadColor: "#6b7280",
  },
  "outer-denim-jacket": {
    fabric: "denim",
    stitch: "atelier",
    wear: 0.15,
    notes: "Trucker cut, brass buttons, faded yoke.",
    threadColor: "#1d4ed8",
    buttons: "#b45309",
  },
  "hat-beanie-green": {
    fabric: "fleece",
    stitch: "home",
    wear: 0.2,
    notes: "Double-layer knit, small tag at cuff.",
    threadColor: "#166534",
  },
  "hat-bucket": {
    fabric: "cotton",
    stitch: "market",
    wear: 0.1,
    notes: "Check print, stitched brim edge.",
    threadColor: "#86efac",
  },
  "hat-wide": {
    fabric: "wool",
    stitch: "atelier",
    wear: 0.05,
    notes: "Wired brim, inner sweatband.",
    threadColor: "#fafaf9",
  },
  "hat-cap": {
    fabric: "cotton",
    stitch: "market",
    wear: 0.22,
    notes: "Curved brim, adjustable strap, sweat stain faint.",
    threadColor: "#0f172a",
    quirk: "Brim curve uneven from pocket storage",
  },
  "acc-shades": {
    fabric: "poly",
    stitch: "atelier",
    wear: 0.1,
    notes: "Smoke lenses, thin metal arms.",
    threadColor: "#1a1a1a",
  },
  "acc-glasses": {
    fabric: "poly",
    stitch: "atelier",
    wear: 0.05,
    notes: "Clear acetate, silicone nose pads.",
    threadColor: "#e2e8f0",
  },
  "acc-hoops": {
    fabric: "metal",
    stitch: "luxury",
    wear: 0.02,
    notes: "Hollow gold-tone hoops, latch closure.",
    threadColor: "#fbbf24",
  },
  "acc-chain": {
    fabric: "metal",
    stitch: "atelier",
    wear: 0.08,
    notes: "Cuban links, lobster clasp, light tarnish near clasp.",
    threadColor: "#e5e7eb",
    quirk: "One link slightly tighter",
  },
  "acc-watch": {
    fabric: "metal",
    stitch: "luxury",
    wear: 0.12,
    notes: "Quartz, mesh band, second hand ticks unevenly.",
    threadColor: "#94a3b8",
  },
  "shoes-red": {
    fabric: "poly",
    stitch: "market",
    wear: 0.15,
    notes: "Gum sole, red upper, lace aglets metal.",
    threadColor: "#ef4444",
  },
  "shoes-boots": {
    fabric: "denim",
    stitch: "luxury",
    wear: 0.1,
    notes: "Denim shaft, side zip, stacked heel.",
    threadColor: "#3b82f6",
  },
  "shoes-white-fresh": {
    fabric: "poly",
    stitch: "atelier",
    wear: 0.02,
    notes: "Still box-white, protective film on sole logo.",
    threadColor: "#ffffff",
  },
};

export type EquippedLoadout = {
  top: string;
  bottom: string;
  outer: string | null;
  shoes: string;
  accessory: string | null;
  hat: string | null;
};

export type EyeShape = "almond" | "round" | "hooded" | "wide";
export type NoseShape = "soft" | "strong" | "wide" | "narrow";
export type LipShape = "full" | "medium" | "thin";
export type FaceMark =
  | "none"
  | "cheek-mole"
  | "brow-scar"
  | "chin-dimple"
  | "temple-birthmark"
  | "freckles";
export type Posture = "upright" | "relaxed" | "confident" | "shy";

export type CharacterAppearance = {
  gender: Gender;
  bodyShape: BodyShape;
  height: HeightId;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  displayName: string;
  /** Unique face / body micro-identity */
  eyeShape: EyeShape;
  eyeColor: string;
  noseShape: NoseShape;
  lipShape: LipShape;
  faceMark: FaceMark;
  /** 0–1 brow thickness */
  browStrength: number;
  /** Asymmetry: ear ring only on one side, etc. */
  leftEarPiercing: boolean;
  rightEarPiercing: boolean;
  nosePiercing: boolean;
  gapTooth: boolean;
  /** Hands / nails */
  nailColor: string;
  /** Posture affects idle pose slightly */
  posture: Posture;
  /** Tailor measurements — flavour for shop NPC */
  sleevePreference: "fitted" | "regular" | "oversized";
  hemPreference: "cropped" | "regular" | "long";
  /** Unique citizen seed for procedural tiny variants */
  detailSeed: number;
};

const DEFAULT_APPEARANCE: CharacterAppearance = {
  gender: "female",
  bodyShape: "average",
  height: "average",
  skin: "#8d5524",
  hair: "braids",
  hairColor: "#1a1a1a",
  displayName: "Citizen",
  eyeShape: "almond",
  eyeColor: "#2c1810",
  noseShape: "soft",
  lipShape: "full",
  faceMark: "none",
  browStrength: 0.7,
  leftEarPiercing: true,
  rightEarPiercing: true,
  nosePiercing: false,
  gapTooth: false,
  nailColor: "#f8fafc",
  posture: "relaxed",
  sleevePreference: "regular",
  hemPreference: "regular",
  detailSeed: 17,
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

  setEyeShape: (eyeShape: EyeShape) => void;
  setEyeColor: (eyeColor: string) => void;
  setNoseShape: (noseShape: NoseShape) => void;
  setLipShape: (lipShape: LipShape) => void;
  setFaceMark: (faceMark: FaceMark) => void;
  setBrowStrength: (n: number) => void;
  setPiercings: (p: Partial<Pick<CharacterAppearance, "leftEarPiercing" | "rightEarPiercing" | "nosePiercing">>) => void;
  setGapTooth: (gapTooth: boolean) => void;
  setNailColor: (nailColor: string) => void;
  setPosture: (posture: Posture) => void;
  setSleevePreference: (sleevePreference: CharacterAppearance["sleevePreference"]) => void;
  setHemPreference: (hemPreference: CharacterAppearance["hemPreference"]) => void;
  randomizeDetails: () => void;
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

  setEyeShape: (eyeShape) => {
    set({ appearance: { ...get().appearance, eyeShape } });
    get().persist();
  },
  setEyeColor: (eyeColor) => {
    set({ appearance: { ...get().appearance, eyeColor } });
    get().persist();
  },
  setNoseShape: (noseShape) => {
    set({ appearance: { ...get().appearance, noseShape } });
    get().persist();
  },
  setLipShape: (lipShape) => {
    set({ appearance: { ...get().appearance, lipShape } });
    get().persist();
  },
  setFaceMark: (faceMark) => {
    set({ appearance: { ...get().appearance, faceMark } });
    get().persist();
  },
  setBrowStrength: (browStrength) => {
    set({ appearance: { ...get().appearance, browStrength } });
    get().persist();
  },
  setPiercings: (p) => {
    set({ appearance: { ...get().appearance, ...p } });
    get().persist();
  },
  setGapTooth: (gapTooth) => {
    set({ appearance: { ...get().appearance, gapTooth } });
    get().persist();
  },
  setNailColor: (nailColor) => {
    set({ appearance: { ...get().appearance, nailColor } });
    get().persist();
  },
  setPosture: (posture) => {
    set({ appearance: { ...get().appearance, posture } });
    get().persist();
  },
  setSleevePreference: (sleevePreference) => {
    set({ appearance: { ...get().appearance, sleevePreference } });
    get().persist();
  },
  setHemPreference: (hemPreference) => {
    set({ appearance: { ...get().appearance, hemPreference } });
    get().persist();
  },
  randomizeDetails: () => {
    const seed = Math.floor(Math.random() * 9999);
    const eyes: EyeShape[] = ["almond", "round", "hooded", "wide"];
    const noses: NoseShape[] = ["soft", "strong", "wide", "narrow"];
    const lips: LipShape[] = ["full", "medium", "thin"];
    const marks: FaceMark[] = ["none", "cheek-mole", "brow-scar", "chin-dimple", "temple-birthmark", "freckles"];
    const postures: Posture[] = ["upright", "relaxed", "confident", "shy"];
    const a = get().appearance;
    set({
      appearance: {
        ...a,
        detailSeed: seed,
        eyeShape: eyes[seed % 4],
        noseShape: noses[seed % 4],
        lipShape: lips[seed % 3],
        faceMark: marks[seed % 6],
        browStrength: 0.4 + (seed % 6) * 0.1,
        leftEarPiercing: seed % 2 === 0,
        rightEarPiercing: seed % 3 !== 0,
        nosePiercing: seed % 7 === 0,
        gapTooth: seed % 11 === 0,
        posture: postures[seed % 4],
        sleevePreference: (["fitted", "regular", "oversized"] as const)[seed % 3],
        hemPreference: (["cropped", "regular", "long"] as const)[seed % 3],
        nailColor: ["#f8fafc", "#fb7185", "#1a1a1a", "#fbbf24"][seed % 4],
      },
    });
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
