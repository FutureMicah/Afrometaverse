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
    color: "#a0623a",
    description: "Coil-built storage pot, fired in the compound.",
  },
  "carved-stool": {
    id: "carved-stool",
    name: "Carved wooden stool",
    source: "crafted",
    width: 1,
    depth: 1,
    color: "#5c4030",
    description: "A stool carved from one block of iroko.",
  },
  "woven-mat": {
    id: "woven-mat",
    name: "Woven reed mat",
    source: "crafted",
    width: 2,
    depth: 1.5,
    color: "#c9a46a",
    description: "Reed mat woven by hand, for sitting or sleeping.",
  },
  "market-cloth": {
    id: "market-cloth",
    name: "Dyed cloth bolt",
    source: "bought",
    width: 1,
    depth: 1,
    color: "#2f5a7a",
    description: "Indigo cloth bought at the market stall.",
  },
  "brass-lamp": {
    id: "brass-lamp",
    name: "Brass oil lamp",
    source: "bought",
    width: 0.5,
    depth: 0.5,
    color: "#b08a4e",
    description: "Oil lamp bought from the trade hut.",
  },
  "trophy-horns": {
    id: "trophy-horns",
    name: "Trophy horns",
    source: "trophy",
    width: 1,
    depth: 0.5,
    color: "#e9e2d0",
    description: "Horns from a hunt you brought down.",
  },
  "leopard-rug": {
    id: "leopard-rug",
    name: "Leopard pelt rug",
    source: "trophy",
    width: 2,
    depth: 1.5,
    color: "#c7902e",
    description: "Pelt from a leopard you tracked and killed.",
  },
  "ceremonial-mask": {
    id: "ceremonial-mask",
    name: "Ceremonial mask",
    source: "trophy",
    width: 0.5,
    depth: 0.5,
    color: "#7a3b1e",
    description: "Mask earned in a masquerade mission.",
  },
  "glazed-pot": {
    id: "glazed-pot",
    name: "Rare glazed pot",
    source: "trophy",
    width: 1,
    depth: 1,
    color: "#2e7a6b",
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
