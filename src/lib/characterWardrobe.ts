import type { NpcRole } from "@/lib/npcSim";

/**
 * Pre-colonial Nigerian wardrobe tiers. Pure data (no three.js import) so the mapping can be
 * unit tested. The renderer in StylizedCharacter turns each GarmentSpec into geometry + material.
 * NO modern clothing exists in this system.
 */

export type WardrobeTier = "commoner" | "married" | "elder" | "warrior" | "hunter" | "royal" | "elite";

export const WARDROBE_TIERS: readonly WardrobeTier[] = ["commoner", "married", "elder", "warrior", "hunter", "royal", "elite"];

export type ClothPattern =
  | "plain"
  | "indigo-check"
  | "kente"
  | "aso-oke"
  | "embroidered"
  | "leopard"
  | "hide"
  | "quilted"
  | "raffia"
  | "gold"
  | "beaded";

export type GarmentKind =
  | "tunic"
  | "wrap-top"
  | "wrapper"
  | "shoulder-cloth"
  | "loincloth"
  | "raffia-skirt"
  | "hide-cape"
  | "waist-beads"
  | "neck-beads"
  | "cap"
  | "braid-beads"
  | "armor-pads"
  | "armband"
  | "medallion"
  | "shield"
  | "feather-crest"
  | "camwood-paint"
  | "dagger";

export type GarmentSpec = {
  kind: GarmentKind;
  color: string;
  pattern: ClothPattern;
  /** wrapper / tunic hem: short (mid thigh), knee, ankle */
  length?: "short" | "knee" | "ankle";
  sleeves?: "none" | "short" | "long";
  /** bead strands for waist-beads / neck-beads */
  strands?: number;
  /** accent colour (pattern detail, bead colour, trim) */
  accent?: string;
};

export type Wardrobe = {
  tier: WardrobeTier;
  label: string;
  garments: GarmentSpec[];
};

export const CORAL = "#ef6a4b";
export const GOLD = "#d9a521";
export const INDIGO = "#2e3a6b";
export const ORANGE = "#d86a1e";
export const RED = "#a8231e";
export const CREAM = "#eadfc7";
export const HIDE = "#7a5230";
export const LEOPARD = "#c98a2c";
export const RAFFIA = "#c9b27a";
export const CAMWOOD = "#8c2a14";

const WARDROBES: Record<WardrobeTier, Record<"male" | "female", Wardrobe>> = {
  commoner: {
    female: {
      tier: "commoner",
      label: "commoner (checked wrap top and short wrapper)",
      garments: [
        { kind: "wrap-top", color: INDIGO, pattern: "indigo-check", accent: ORANGE, sleeves: "none" },
        { kind: "wrapper", color: ORANGE, pattern: "indigo-check", accent: INDIGO, length: "short" },
        { kind: "waist-beads", color: CORAL, pattern: "beaded", strands: 2 },
        { kind: "neck-beads", color: CORAL, pattern: "beaded", strands: 1 },
      ],
    },
    male: {
      tier: "commoner",
      label: "commoner (plain tunic and indigo wrapper)",
      garments: [
        { kind: "tunic", color: CREAM, pattern: "plain", sleeves: "short", length: "knee" },
        { kind: "wrapper", color: INDIGO, pattern: "indigo-check", accent: ORANGE, length: "knee" },
      ],
    },
  },
  married: {
    female: {
      tier: "married",
      label: "married woman (red knotted wrap dress, coral set)",
      garments: [
        { kind: "wrap-top", color: RED, pattern: "plain", sleeves: "none" },
        { kind: "wrapper", color: RED, pattern: "plain", length: "ankle" },
        { kind: "waist-beads", color: CORAL, pattern: "beaded", strands: 5 },
        { kind: "neck-beads", color: CORAL, pattern: "beaded", strands: 3 },
        { kind: "braid-beads", color: CORAL, pattern: "beaded", accent: GOLD },
      ],
    },
    male: {
      tier: "married",
      label: "married (wrapper, coral set)",
      garments: [
        { kind: "tunic", color: CREAM, pattern: "plain", sleeves: "short", length: "knee" },
        { kind: "wrapper", color: RED, pattern: "plain", length: "knee" },
        { kind: "neck-beads", color: CORAL, pattern: "beaded", strands: 2 },
      ],
    },
  },
  elder: {
    female: {
      tier: "elder",
      label: "elder (kente one-shoulder wrapper, coral beads)",
      garments: [
        { kind: "shoulder-cloth", color: "#1a1a1a", pattern: "kente", accent: GOLD },
        { kind: "wrapper", color: "#1a1a1a", pattern: "kente", accent: GOLD, length: "ankle" },
        { kind: "waist-beads", color: CORAL, pattern: "beaded", strands: 2 },
        { kind: "neck-beads", color: CORAL, pattern: "beaded", strands: 2 },
      ],
    },
    male: {
      tier: "elder",
      label: "elder (kente wrapper over cream tunic, coral beads)",
      garments: [
        { kind: "tunic", color: CREAM, pattern: "embroidered", accent: INDIGO, sleeves: "long", length: "knee" },
        { kind: "shoulder-cloth", color: "#1a1a1a", pattern: "kente", accent: GOLD },
        { kind: "wrapper", color: "#1a1a1a", pattern: "kente", accent: GOLD, length: "ankle" },
        { kind: "neck-beads", color: CORAL, pattern: "beaded", strands: 2 },
      ],
    },
  },
  warrior: {
    female: {
      tier: "warrior",
      label: "warrior (quilted esa pads, gold and coral neckpieces, camwood paint)",
      garments: [
        { kind: "armor-pads", color: INDIGO, pattern: "quilted", accent: CREAM },
        { kind: "wrapper", color: INDIGO, pattern: "indigo-check", accent: CREAM, length: "knee" },
        { kind: "neck-beads", color: GOLD, pattern: "gold", strands: 2 },
        { kind: "neck-beads", color: CORAL, pattern: "beaded", strands: 1 },
        { kind: "armband", color: GOLD, pattern: "gold" },
        { kind: "camwood-paint", color: CAMWOOD, pattern: "plain" },
        { kind: "dagger", color: GOLD, pattern: "gold" },
      ],
    },
    male: {
      tier: "warrior",
      label: "warrior (quilted esa pads, gold and coral neckpieces, camwood paint)",
      garments: [
        { kind: "armor-pads", color: INDIGO, pattern: "quilted", accent: CREAM },
        { kind: "wrapper", color: INDIGO, pattern: "indigo-check", accent: CREAM, length: "knee" },
        { kind: "neck-beads", color: GOLD, pattern: "gold", strands: 2 },
        { kind: "neck-beads", color: CORAL, pattern: "beaded", strands: 1 },
        { kind: "armband", color: GOLD, pattern: "gold" },
        { kind: "camwood-paint", color: CAMWOOD, pattern: "plain" },
        { kind: "dagger", color: GOLD, pattern: "gold" },
      ],
    },
  },
  hunter: {
    female: {
      tier: "hunter",
      label: "hunter (animal-skin regalia, raffia, dagger)",
      garments: [
        { kind: "hide-cape", color: HIDE, pattern: "hide" },
        { kind: "loincloth", color: HIDE, pattern: "hide" },
        { kind: "raffia-skirt", color: RAFFIA, pattern: "raffia" },
        { kind: "neck-beads", color: CREAM, pattern: "beaded", strands: 1 },
        { kind: "dagger", color: "#7a7a7a", pattern: "plain" },
      ],
    },
    male: {
      tier: "hunter",
      label: "hunter (animal-skin regalia, raffia, dagger)",
      garments: [
        { kind: "hide-cape", color: HIDE, pattern: "hide" },
        { kind: "loincloth", color: HIDE, pattern: "hide" },
        { kind: "raffia-skirt", color: RAFFIA, pattern: "raffia" },
        { kind: "neck-beads", color: CREAM, pattern: "beaded", strands: 1 },
        { kind: "dagger", color: "#7a7a7a", pattern: "plain" },
      ],
    },
  },
  royal: {
    female: {
      tier: "royal",
      label: "chief (aso oke wrapper, embroidered tunic, coral and gold beads, fila cap, gold medallion)",
      garments: [
        { kind: "wrap-top", color: CREAM, pattern: "embroidered", accent: INDIGO, sleeves: "short" },
        { kind: "wrapper", color: CREAM, pattern: "aso-oke", accent: GOLD, length: "ankle" },
        { kind: "waist-beads", color: GOLD, pattern: "gold", strands: 3 },
        { kind: "neck-beads", color: CORAL, pattern: "beaded", strands: 3 },
        { kind: "neck-beads", color: GOLD, pattern: "gold", strands: 2 },
        { kind: "braid-beads", color: GOLD, pattern: "gold" },
        { kind: "cap", color: CORAL, pattern: "beaded", accent: GOLD },
        { kind: "medallion", color: GOLD, pattern: "gold" },
        { kind: "armband", color: GOLD, pattern: "gold" },
      ],
    },
    male: {
      tier: "royal",
      label: "chief (aso oke wrapper, embroidered tunic, coral and gold beads, fila cap, gold medallion)",
      garments: [
        { kind: "tunic", color: CREAM, pattern: "embroidered", accent: INDIGO, sleeves: "long", length: "knee" },
        { kind: "wrapper", color: CREAM, pattern: "aso-oke", accent: GOLD, length: "ankle" },
        { kind: "neck-beads", color: CORAL, pattern: "beaded", strands: 3 },
        { kind: "neck-beads", color: GOLD, pattern: "gold", strands: 2 },
        { kind: "cap", color: CORAL, pattern: "beaded", accent: GOLD },
        { kind: "medallion", color: GOLD, pattern: "gold" },
        { kind: "armband", color: GOLD, pattern: "gold" },
      ],
    },
  },
  elite: {
    female: {
      tier: "elite",
      label: "elite heavy warrior (leopard-hide regalia, hide shield, feathered headpiece)",
      garments: [
        { kind: "hide-cape", color: LEOPARD, pattern: "leopard" },
        { kind: "loincloth", color: LEOPARD, pattern: "leopard" },
        { kind: "shield", color: HIDE, pattern: "hide" },
        { kind: "feather-crest", color: CREAM, pattern: "plain" },
        { kind: "neck-beads", color: GOLD, pattern: "gold", strands: 2 },
        { kind: "armband", color: GOLD, pattern: "gold" },
        { kind: "camwood-paint", color: CAMWOOD, pattern: "plain" },
        { kind: "dagger", color: GOLD, pattern: "gold" },
      ],
    },
    male: {
      tier: "elite",
      label: "elite heavy warrior (leopard-hide regalia, hide shield, feathered headpiece)",
      garments: [
        { kind: "hide-cape", color: LEOPARD, pattern: "leopard" },
        { kind: "loincloth", color: LEOPARD, pattern: "leopard" },
        { kind: "shield", color: HIDE, pattern: "hide" },
        { kind: "feather-crest", color: CREAM, pattern: "plain" },
        { kind: "neck-beads", color: GOLD, pattern: "gold", strands: 2 },
        { kind: "armband", color: GOLD, pattern: "gold" },
        { kind: "camwood-paint", color: CAMWOOD, pattern: "plain" },
        { kind: "dagger", color: GOLD, pattern: "gold" },
      ],
    },
  },
};

/** The wardrobe for a tier. Gender only changes the commoner, married and warrior-sized looks. */
export function wardrobeFor(tier: WardrobeTier, gender: "male" | "female"): Wardrobe {
  return WARDROBES[tier][gender];
}

/** NPC role to wardrobe tier. Traders, fishers, farmers and herders are commoners. */
export function tierForRole(role: NpcRole | "chief"): WardrobeTier {
  switch (role) {
    case "elder":
      return "elder";
    case "guard":
      return "warrior";
    case "chief":
      return "royal";
    case "trader":
    case "fisher":
    case "farmer":
    case "herder":
      return "commoner";
  }
}
