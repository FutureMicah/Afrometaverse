import { DECOR_PALETTE } from "@/data/decorPalette";
/**
 * Player housing decoration catalog (era-progression-spec.md 18).
 * Every item has one source: crafted, bought or trophy. Trophies are never sold.
 */

export type DecorSource = "crafted" | "bought" | "trophy";

export interface DecorItem {
  id: string;
  name: string;
  source: DecorSource;
  /** Footprint in metres at rotation 0: width (x) and depth (z). */
  width: number;
  depth: number;
  /** Colour of the placeholder mesh until real models exist. */
  color: string;
  description: string;
}

export const DECOR_CATALOG: Record<string, DecorItem> = {
  "clay-pot": {
    id: "clay-pot",
    name: "Clay storage pot",
    source: "crafted",
    width: 1,
    depth: 1,
    color: DECOR_PALETTE.clayPot,
    description: "Coil-built storage pot, fired in the compound.",
  },
  "carved-stool": {
    id: "carved-stool",
    name: "Carved wooden stool",
    source: "crafted",
    width: 1,
    depth: 1,
    color: DECOR_PALETTE.carvedStool,
    description: "A stool carved from one block of iroko.",
  },
  "woven-mat": {
    id: "woven-mat",
    name: "Woven reed mat",
    source: "crafted",
    width: 2,
    depth: 1.5,
    color: DECOR_PALETTE.wovenMat,
    description: "Reed mat woven by hand, for sitting or sleeping.",
  },
  "market-cloth": {
    id: "market-cloth",
    name: "Dyed cloth bolt",
    source: "bought",
    width: 1,
    depth: 1,
    color: DECOR_PALETTE.marketCloth,
    description: "Indigo cloth bought at the market stall.",
  },
  "brass-lamp": {
    id: "brass-lamp",
    name: "Brass oil lamp",
    source: "bought",
    width: 0.5,
    depth: 0.5,
    color: DECOR_PALETTE.brassLamp,
    description: "Oil lamp bought from the trade hut.",
  },
  "trophy-horns": {
    id: "trophy-horns",
    name: "Trophy horns",
    source: "trophy",
    width: 1,
    depth: 0.5,
    color: DECOR_PALETTE.trophyHorns,
    description: "Horns from a hunt you brought down.",
  },
  "leopard-rug": {
    id: "leopard-rug",
    name: "Leopard pelt rug",
    source: "trophy",
    width: 2,
    depth: 1.5,
    color: DECOR_PALETTE.leopardRug,
    description: "Pelt from a leopard you tracked and killed.",
  },
  "ceremonial-mask": {
    id: "ceremonial-mask",
    name: "Ceremonial mask",
    source: "trophy",
    width: 0.5,
    depth: 0.5,
    color: DECOR_PALETTE.ceremonialMask,
    description: "Mask earned in a masquerade mission.",
  },
  "glazed-pot": {
    id: "glazed-pot",
    name: "Rare glazed pot",
    source: "trophy",
    width: 1,
    depth: 1,
    color: DECOR_PALETTE.glazedPot,
    description: "A rare glazed pot won in a craft trial.",
  },
};

export function getDecorItem(id: string): DecorItem | undefined {
  return DECOR_CATALOG[id];
}

/** Footprint of an item after a quarter-turn rotation (rot in 0, 1, 2, 3 quarter turns). */
export function footprintAt(item: DecorItem, rot: number): { w: number; d: number } {
  const turned = ((rot % 4) + 4) % 4 % 2 === 1;
  return turned ? { w: item.depth, d: item.width } : { w: item.width, d: item.depth };
}
