import type { InteriorId } from "@/stores/interiorStore";

/**
 * Basic starter furnishings for each interior (pre-colonial Nigerian, Yoruba/Igbo-style
 * compound life): woven mats, clay pots, gourds, wooden stools, a hearth. Every room
 * starts lived-in with these fixtures. Richer pieces are earned or bought later
 * (see `later`), and player-placed decor lives in data/decor.ts.
 *
 * Coordinates are room-local metres, the same frame as the room shell (6 x 5 m, front wall at +z).
 */

export type StarterKind =
  | "hearth"
  | "firewood"
  | "mat"
  | "stool"
  | "waterPot"
  | "woodBowl"
  | "calabash"
  | "goods"
  | "clothBolt"
  | "basket"
  | "palmOilJar"
  | "drum"
  | "clayLamp"
  | "logPile"
  | "toolRack"
  | "blockPile"
  | "benchTable"
  | "benchTool"
  | "scale"
  | "shelf"
  | "hangingGourd"
  | "matLayer";

export interface StarterItem {
  id: string;
  kind: StarterKind;
  name: string;
  x: number;
  z: number;
  /** Height override for pieces that sit on a mat or table. Defaults to the floor. */
  y?: number;
  /** Quarter turns around the vertical axis (only for pieces with a facing). */
  rot?: number;
}

/** A piece the player can get later. `decorId` points at data/decor.ts. */
export interface LaterItem {
  decorId: string;
  how: "craft" | "buy" | "earn";
  /** Proposed City Coin price for `buy` items. Not wired to any stall yet. */
  price?: number;
  note: string;
}

export interface RoomStarter {
  items: StarterItem[];
  later: LaterItem[];
}

export const STARTER: Record<InteriorId, RoomStarter> = {
  safehouse: {
    items: [
      { id: "sh-hearth", kind: "hearth", name: "Hearth", x: -1.6, z: -1.2 },
      { id: "sh-sleep-mat", kind: "mat", name: "Sleeping mat", x: 0, z: -2.2 },
      { id: "sh-sit-mat", kind: "mat", name: "Sitting mat", x: 1, z: -1 },
      { id: "sh-stool-1", kind: "stool", name: "Wooden stool", x: -1.2, z: 0.6 },
      { id: "sh-stool-2", kind: "stool", name: "Wooden stool", x: -0.4, z: 0.9 },
      { id: "sh-pot-1", kind: "waterPot", name: "Clay water pot", x: 1.9, z: -1.8 },
      { id: "sh-pot-2", kind: "waterPot", name: "Clay water pot", x: 2.4, z: -1.6 },
      { id: "sh-bowl", kind: "woodBowl", name: "Wooden bowl", x: 0.5, z: 0.2 },
      { id: "sh-calabash", kind: "calabash", name: "Calabash gourd", x: -2.2, z: -0.4 },
      { id: "sh-basket", kind: "basket", name: "Yam basket", x: -2.1, z: 1.6 },
      { id: "sh-drum", kind: "drum", name: "Talking drum", x: 2.1, z: 0.8 },
      { id: "sh-lamp", kind: "clayLamp", name: "Clay oil lamp", x: 2.2, z: -0.6 },
      { id: "sh-shelf", kind: "shelf", name: "Wall shelf of pots and calabashes", x: 2.6, z: 1.6 },
      { id: "sh-gourd-1", kind: "hangingGourd", name: "Gourd hanging from the roof beam", x: 0.3, z: 0.4, y: 1.9 },
      { id: "sh-gourd-2", kind: "hangingGourd", name: "Gourd hanging from the roof beam", x: -0.8, z: -0.4, y: 2.0 },
      { id: "sh-layer", kind: "matLayer", name: "Rush mat laid over the sitting mat", x: 1, z: -1 },
    ],
    later: [
      { decorId: "woven-mat", how: "craft", note: "weave a reed mat at home" },
      { decorId: "carved-stool", how: "craft", note: "carve it at the work bench" },
      { decorId: "clay-pot", how: "craft", note: "coil and fire it in the compound" },
      { decorId: "market-cloth", how: "buy", price: 90, note: "indigo cloth from the trade hut" },
      { decorId: "brass-lamp", how: "buy", price: 120, note: "brass oil lamp from the trade hut" },
      { decorId: "leopard-rug", how: "earn", note: "pelt from a leopard hunt" },
      { decorId: "ceremonial-mask", how: "earn", note: "from a masquerade mission" },
      { decorId: "glazed-pot", how: "earn", note: "won in a craft trial" },
    ],
  },
  "market-shop": {
    items: [
      { id: "mk-mat", kind: "mat", name: "Trader's mat", x: 0, z: -1.6 },
      { id: "mk-goods", kind: "goods", name: "Yams, kola and salt", x: -0.4, z: -1.6, y: 0.04 },
      { id: "mk-bowl-1", kind: "woodBowl", name: "Wooden bowl", x: 0.9, z: -1.7, y: 0.06 },
      { id: "mk-bowl-2", kind: "woodBowl", name: "Wooden bowl", x: 1.3, z: -1.5, y: 0.06 },
      { id: "mk-cloth", kind: "clothBolt", name: "Cloth bolt", x: -1.7, z: -1.7 },
      { id: "mk-pot-1", kind: "waterPot", name: "Clay pot", x: 1.8, z: -0.2 },
      { id: "mk-pot-2", kind: "waterPot", name: "Clay pot", x: 2.3, z: -0.2 },
      { id: "mk-display-mat", kind: "mat", name: "Display mat", x: 1.6, z: 1.2 },
      { id: "mk-display-goods", kind: "goods", name: "Market goods", x: 1.6, z: 1.2, y: 0.04 },
      { id: "mk-stool", kind: "stool", name: "Wooden stool", x: -0.6, z: -0.2 },
      { id: "mk-fire", kind: "firewood", name: "Cooking fire", x: -2, z: 1.4 },
      { id: "mk-oil", kind: "palmOilJar", name: "Palm oil jar", x: -2.2, z: -0.9 },
      { id: "mk-kola", kind: "basket", name: "Kola basket", x: 2.2, z: -1.1 },
      { id: "mk-scale", kind: "scale", name: "Trade scale", x: 0.2, z: 0.9 },
      { id: "mk-shelf", kind: "shelf", name: "Shelf of dyed cloth and pots", x: 2.6, z: -1.8 },
      { id: "mk-cloth-hang", kind: "hangingGourd", name: "Dyed cloth hung from the beam", x: -0.8, z: 0.6, y: 1.9 },
    ],
    later: [
      { decorId: "market-cloth", how: "buy", price: 90, note: "indigo cloth from this stall" },
      { decorId: "brass-lamp", how: "buy", price: 120, note: "brass oil lamp from this stall" },
      { decorId: "clay-pot", how: "craft", note: "coil and fire it in your compound" },
    ],
  },
  workplace: {
    items: [
      { id: "wp-bench", kind: "benchTable", name: "Carver's bench", x: 0, z: -1.6 },
      { id: "wp-tool", kind: "benchTool", name: "Chisel on the bench", x: 0.3, z: -1.6, y: 0.6 },
      { id: "wp-pot-1", kind: "waterPot", name: "Clay water pot", x: 1.6, z: -1.8 },
      { id: "wp-pot-2", kind: "waterPot", name: "Clay water pot", x: -1.8, z: -1.8 },
      { id: "wp-stool-1", kind: "stool", name: "Wooden stool", x: 0, z: -0.2 },
      { id: "wp-stool-2", kind: "stool", name: "Wooden stool", x: 1.6, z: 0.6 },
      { id: "wp-mat", kind: "mat", name: "Sitting mat", x: -1.4, z: 1 },
      { id: "wp-fire", kind: "firewood", name: "Forge fire", x: 2, z: 1.4 },
      { id: "wp-logs", kind: "logPile", name: "Log pile", x: -2.1, z: -0.2 },
      { id: "wp-rack", kind: "toolRack", name: "Adze and chisel rack", x: -2.6, z: -1 },
      { id: "wp-blocks", kind: "blockPile", name: "Carving blocks", x: 1.9, z: -0.6 },
      { id: "wp-shelf", kind: "shelf", name: "Shelf of finished stools", x: 2.6, z: 0.6 },
      { id: "wp-hang", kind: "hangingGourd", name: "Bundled dried herbs from the beam", x: -0.6, z: 0.8, y: 1.9 },
    ],
    later: [
      { decorId: "carved-stool", how: "craft", note: "carve it at this bench" },
      { decorId: "clay-pot", how: "craft", note: "coil and fire it in your compound" },
      { decorId: "woven-mat", how: "craft", note: "weave a reed mat at home" },
      { decorId: "glazed-pot", how: "earn", note: "won in a craft trial" },
    ],
  },
};

export const STARTER_KINDS: StarterKind[] = [
  "hearth",
  "firewood",
  "mat",
  "stool",
  "waterPot",
  "woodBowl",
  "calabash",
  "goods",
  "clothBolt",
  "basket",
  "palmOilJar",
  "drum",
  "clayLamp",
  "logPile",
  "toolRack",
  "blockPile",
  "benchTable",
  "benchTool",
  "scale",
  "shelf",
  "hangingGourd",
  "matLayer",
];
