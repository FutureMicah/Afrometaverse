import {
  CLOTHING_CATALOG,
  type ClothingItem,
  type EquippedLoadout,
} from "@/stores/characterStore";

/** Style axes used by the matching engine */
export type StyleTag =
  | "casual"
  | "street"
  | "formal"
  | "bold"
  | "minimal"
  | "night"
  | "market"
  | "civic"
  | "sport";

export type MatchTier = "clashing" | "basic" | "solid" | "sharp" | "iconic";

export type OutfitMatchResult = {
  score: number; // 0–100
  tier: MatchTier;
  label: string;
  tips: string[];
  tags: StyleTag[];
  bonuses: string[];
  /** Small soft boosts for gameplay flavour */
  repBonus: number;
  coinFindBonus: number;
};

const TAGS: Record<string, StyleTag[]> = {
  "top-white-tee": ["casual", "minimal"],
  "bottom-blue-jeans": ["casual", "street"],
  "shoes-basic": ["casual", "minimal"],
  "top-black-tee": ["casual", "minimal", "night"],
  "bottom-black-jeans": ["street", "night", "minimal"],
  "top-coral": ["bold", "market"],
  "top-olive": ["civic", "minimal"],
  "top-neon": ["bold", "night", "street"],
  "top-ankara": ["bold", "market"],
  "bottom-white-wide": ["minimal", "casual"],
  "bottom-cargo": ["street", "sport"],
  "bottom-skirt": ["bold", "market"],
  "outer-pink-fur": ["bold", "night"],
  "outer-coral-coat": ["bold", "street"],
  "outer-grey-crew": ["casual", "minimal", "civic"],
  "outer-denim-jacket": ["street", "casual"],
  "hat-beanie-green": ["casual", "street"],
  "hat-bucket": ["street", "market"],
  "hat-wide": ["bold", "market"],
  "hat-cap": ["casual", "sport"],
  "acc-shades": ["night", "street", "bold"],
  "acc-glasses": ["civic", "minimal"],
  "acc-hoops": ["bold", "market"],
  "acc-chain": ["street", "night", "bold"],
  "acc-watch": ["civic", "formal"],
  "shoes-red": ["bold", "sport"],
  "shoes-boots": ["bold", "street"],
  "shoes-white-fresh": ["minimal", "sport", "casual"],
};

/** Known intentional sets → bonus when 2+ pieces equipped */
const SETS: { name: string; ids: string[]; bonus: number }[] = [
  {
    name: "Fresh minimal",
    ids: ["top-white-tee", "bottom-white-wide", "shoes-white-fresh"],
    bonus: 12,
  },
  {
    name: "Night runner",
    ids: ["top-black-tee", "bottom-black-jeans", "acc-shades", "shoes-basic"],
    bonus: 14,
  },
  {
    name: "Market loud",
    ids: ["top-ankara", "bottom-skirt", "acc-hoops", "hat-bucket"],
    bonus: 15,
  },
  {
    name: "Civic clean",
    ids: ["top-olive", "outer-grey-crew", "acc-glasses", "acc-watch"],
    bonus: 13,
  },
  {
    name: "Street heat",
    ids: ["outer-coral-coat", "bottom-cargo", "acc-chain", "hat-cap"],
    bonus: 14,
  },
  {
    name: "Starter solid",
    ids: ["top-white-tee", "bottom-blue-jeans", "shoes-basic"],
    bonus: 6,
  },
];

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(rgb: [number, number, number]) {
  const [r = 0, g = 0, b = 0] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function colorDistance(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 50;
  return Math.sqrt(
    (ra[0] - rb[0]) ** 2 + (ra[1] - rb[1]) ** 2 + (ra[2] - rb[2]) ** 2,
  );
}

function equippedItems(loadout: EquippedLoadout): ClothingItem[] {
  const ids = [
    loadout.top,
    loadout.bottom,
    loadout.outer,
    loadout.shoes,
    loadout.accessory,
    loadout.hat,
  ].filter(Boolean) as string[];
  return ids
    .map((id) => CLOTHING_CATALOG.find((c) => c.id === id))
    .filter(Boolean) as ClothingItem[];
}

function tierFromScore(score: number): MatchTier {
  if (score >= 85) return "iconic";
  if (score >= 70) return "sharp";
  if (score >= 55) return "solid";
  if (score >= 35) return "basic";
  return "clashing";
}

const TIER_LABEL: Record<MatchTier, string> = {
  clashing: "Clashing",
  basic: "Basic fit",
  solid: "Solid match",
  sharp: "Sharp look",
  iconic: "Iconic fit",
};

/**
 * Outfit matching engine — scores cohesion of the current loadout.
 * Uses style tags, colour distance, slot coverage, and named sets.
 */
export function matchOutfit(loadout: EquippedLoadout): OutfitMatchResult {
  const items = equippedItems(loadout);
  const tips: string[] = [];
  const bonuses: string[] = [];
  let score = 40; // baseline dressed citizen

  // Slot coverage
  const slotsFilled = items.length;
  score += Math.min(18, slotsFilled * 3);
  if (!loadout.outer) tips.push("An outer layer can pull the look together.");
  if (!loadout.hat) tips.push("A hat or cap adds silhouette.");
  if (!loadout.accessory) tips.push("Jewellery or shades finish the fit.");

  // Style tag cohesion
  const tagCounts = new Map<StyleTag, number>();
  for (const item of items) {
    for (const tag of TAGS[item.id] ?? ["casual"]) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
  const dominant = sortedTags.slice(0, 3).map(([t]) => t);
  const topCount = sortedTags[0]?.[1] ?? 0;
  const topTag = sortedTags[0]?.[0] ?? "";
  if (topCount >= 3) {
    score += 16;
    bonuses.push(`Strong ${topTag} story`);
  } else if (topCount >= 2) {
    score += 10;
    bonuses.push(`${topTag} leaning`);
  } else {
    score -= 4;
    tips.push("Pieces speak different languages — pick a lane (street, civic, market…).");
  }

  // Conflict: formal + loud street without bridge
  const hasFormal = (tagCounts.get("formal") ?? 0) > 0;
  const hasBold = (tagCounts.get("bold") ?? 0) > 0;
  const hasMinimal = (tagCounts.get("minimal") ?? 0) > 0;
  if (hasFormal && hasBold && !hasMinimal) {
    score -= 8;
    tips.push("Formal watch with loud pieces needs a calmer bridge layer.");
  }

  // Colour harmony (average pairwise distance among main garments)
  const mains = items.filter((i) =>
    ["top", "bottom", "outer", "shoes"].includes(i.slot),
  );
  if (mains.length >= 2) {
    let distSum = 0;
    let pairs = 0;
    for (let i = 0; i < mains.length; i++) {
      for (let j = i + 1; j < mains.length; j++) {
        const mi = mains[i], mj = mains[j];
        if (!mi || !mj) continue;
        distSum += colorDistance(mi.color, mj.color);
        pairs++;
      }
    }
    const avg = pairs ? distSum / pairs : 0;
    // Sweet spot: not all identical, not pure chaos
    if (avg < 40) {
      score += 6;
      bonuses.push("Tonal colours");
    } else if (avg < 120) {
      score += 12;
      bonuses.push("Balanced contrast");
    } else if (avg < 200) {
      score += 4;
    } else {
      score -= 10;
      tips.push("Colours fight — try one bold piece and quieter partners.");
    }

    // Neutrals play well
    const luminances = mains
      .map((m) => hexToRgb(m.color))
      .filter(Boolean)
      .map((rgb) => relativeLuminance(rgb as [number, number, number]));
    const neutralish = luminances.filter((l) => l < 0.12 || l > 0.75).length;
    if (neutralish >= 2) {
      score += 5;
      bonuses.push("Neutral anchors");
    }
  }

  // Named sets
  const equippedIds = new Set(items.map((i) => i.id));
  for (const set of SETS) {
    const hit = set.ids.filter((id) => equippedIds.has(id)).length;
    if (hit >= 2) {
      const partial = Math.round(set.bonus * (hit / set.ids.length));
      score += partial;
      bonuses.push(
        hit >= set.ids.length - 1
          ? `${set.name} set`
          : `${set.name} (${hit}/${set.ids.length})`,
      );
    }
  }

  // Starter awareness
  if (
    loadout.top === "top-white-tee" &&
    loadout.bottom === "bottom-blue-jeans" &&
    !loadout.outer
  ) {
    tips.push("Starter fit is clean — mission drops and the fashion stall unlock more range.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier = tierFromScore(score);

  // Soft gameplay flavour (UI can show; economy can optionally apply)
  const repBonus = tier === "iconic" ? 2 : tier === "sharp" ? 1 : 0;
  const coinFindBonus = tier === "iconic" ? 5 : tier === "sharp" ? 3 : tier === "solid" ? 1 : 0;

  if (tips.length > 3) tips.length = 3;

  return {
    score,
    tier,
    label: TIER_LABEL[tier],
    tips,
    tags: dominant,
    bonuses: bonuses.slice(0, 4),
    repBonus,
    coinFindBonus,
  };
}

export function matchTierColor(tier: MatchTier): string {
  switch (tier) {
    case "iconic":
      return "#a3e635";
    case "sharp":
      return "#22d3ee";
    case "solid":
      return "#fbbf24";
    case "basic":
      return "#94a3b8";
    default:
      return "#f87171";
  }
}
