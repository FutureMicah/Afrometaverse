/**
 * NPCs who live in enterable interiors — dialogue, moods, and actions by time of day.
 */

import type { InteriorId } from "@/stores/interiorStore";
import type { TimeOfDay } from "@/stores/weatherStore";

export type NpcActionId =
  | "rest"
  | "kola"
  | "blessing"
  | "buy"
  | "haggle"
  | "gossip"
  | "shift"
  | "practice"
  | "exit_talk";

export type NpcAction = {
  id: NpcActionId;
  label: string;
  /** Optional KOWRY cost */
  kowryCost?: number;
  /** Flavor shown after success */
  result: string;
};

export type InteriorNpcDef = {
  id: string;
  interiorId: InteriorId;
  name: string;
  role: string;
  /** Skin tone hex */
  skin: string;
  /** Cloth colour */
  cloth: string;
  /** Position in room local space */
  position: [number, number, number];
  /** Facing yaw */
  facing: number;
  lines: Record<TimeOfDay, string[]>;
  actions: NpcAction[];
};

export const INTERIOR_NPCS: InteriorNpcDef[] = [
  {
    id: "mama-adaeze",
    interiorId: "safehouse",
    name: "Mama Adaeze",
    role: "Compound elder",
    skin: "#8d5524",
    cloth: "#5c2e1f",
    position: [-1.4, 0, 1.3],
    facing: 0.4,
    lines: {
      morning: [
        "The hearth is already warm. Sit, child — the day has teeth.",
        "I swept the compound at first light. Rest if the street tired you.",
      ],
      afternoon: [
        "Heat is sitting on the roof like a heavy cloth. Drink water.",
        "Your cousin sent word from the market. Don't chase trouble.",
      ],
      evening: [
        "Lamp oil is low. Close the shutter if the harmattan starts.",
        "Come, share the fire. Outside, the boys are loud again.",
      ],
      night: [
        "Night watches the compound. Sleep light if your heat is high.",
        "I kept kola for you. Elders don't forget their own.",
      ],
    },
    actions: [
      { id: "rest", label: "Rest by the hearth", result: "Warmth settles into your bones. Heat eases." },
      {
        id: "kola",
        label: "Share kola (1 🐚)",
        kowryCost: 1,
        result: "Bitter, then sweet. Mama nods. You feel steadier.",
      },
      {
        id: "blessing",
        label: "Ask for a blessing",
        result: "She touches your forehead. 'Walk gentle. Come home whole.'",
      },
    ],
  },
  {
    id: "trader-chike",
    interiorId: "market-shop",
    name: "Chike the Trader",
    role: "Mat merchant",
    skin: "#c68642",
    cloth: "#1e6b4f",
    position: [1.2, 0, -1.4],
    facing: Math.PI,
    lines: {
      morning: [
        "Fresh basins just arrived. Prices are honest before the sun climbs.",
        "You look like someone who pays in cowries *and* stories.",
      ],
      afternoon: [
        "Afternoon tax is real — everyone wants shade and pepper.",
        "If you haggle, make it clever. I respect clever.",
      ],
      evening: [
        "Torch oil is dear. Evening goods cost more — that is the way of the market.",
        "The night watch walks thick near the grove after dark.",
      ],
      night: [
        "Night trade is for the brave and the broke. Choose carefully.",
        "I keep one last bag of grain for regulars. Are you a regular yet?",
      ],
    },
    actions: [
      { id: "buy", label: "Browse the mat", result: "Chike fans a hand over the goods." },
      {
        id: "haggle",
        label: "Haggle (2 🐚)",
        kowryCost: 2,
        result: "He laughs, then cuts a quiet deal into the next purchase.",
      },
      {
        id: "gossip",
        label: "Ask for street news",
        result: "He leans in with a tip about heat, patrols, or a fat job.",
      },
    ],
  },
  {
    id: "trader-amina",
    interiorId: "market-shop",
    name: "Amina",
    role: "Cloth & beads",
    skin: "#5c3317",
    cloth: "#7c2d12",
    position: [-1.6, 0, -0.5],
    facing: 0.8,
    lines: {
      morning: [
        "Indigo is still damp from the dye pot. Touch gently.",
        "Beads from Onitsha this week — real glass, not plastic shine.",
      ],
      afternoon: [
        "Everyone wants red today. Red sells before the sun softens.",
        "If your coin is short, I trade stories for a discount. Good stories.",
      ],
      evening: [
        "Lamp light loves gold thread. Come see before I fold the bolts.",
        "Night market starts when the torches are lit. Stay sharp.",
      ],
      night: [
        "I keep one wrapper for wedding season. Not for window-shoppers.",
        "Lock the beads. Night fingers are faster than day ones.",
      ],
    },
    actions: [
      { id: "buy", label: "Look at cloth", result: "Amina unrolls a strip of patterned cloth across her arm." },
      {
        id: "haggle",
        label: "Haggle beads (2 🐚)",
        kowryCost: 2,
        result: "She counts beads into your palm and names a fair price.",
      },
      {
        id: "gossip",
        label: "Market talk",
        result: "She whispers which stalls still have yam and which raised prices.",
      },
    ],
  },
  {
    id: "buyer-tunde",
    interiorId: "market-shop",
    name: "Tunde",
    role: "Regular customer",
    skin: "#a67c52",
    cloth: "#2563eb",
    position: [0.3, 0, 1.2],
    facing: -0.6,
    lines: {
      morning: [
        "I come early so Chike doesn't sell the good pepper to someone else.",
        "You new here? Watch the scales — some traders are poets with numbers.",
      ],
      afternoon: [
        "Heat makes people buy water and argue. Same every day.",
        "I'm waiting on a bag of grain. Might be a while.",
      ],
      evening: [
        "Evening crowd is worse. Elbows and dust.",
        "If you need a job tip, ask the cloth woman — she hears everything.",
      ],
      night: [
        "I should go home. The street is changing temper.",
        "One more look at the mats, then I'm done. Maybe.",
      ],
    },
    actions: [
      { id: "gossip", label: "Chat about prices", result: "Tunde compares last week's rates with today's." },
      {
        id: "exit_talk",
        label: "Wish him luck",
        result: "He nods. 'May your coin stretch.'",
      },
    ],
  },
  {
    id: "hawker-blessing",
    interiorId: "market-shop",
    name: "Blessing",
    role: "Produce hawker",
    skin: "#8d5524",
    cloth: "#ca8a04",
    position: [-0.8, 0, -1.6],
    facing: Math.PI * 0.15,
    lines: {
      morning: [
        "Fresh okra! Tomato still cool from the basket!",
        "Buy two, I throw a pepper. Morning special.",
      ],
      afternoon: [
        "Tomato softens in this sun — price drops if you take the lot.",
        "Don't squeeze the yam like it owes you money.",
      ],
      evening: [
        "Last baskets. I don't carry them home heavier than I came.",
        "Oil is finished. Tomorrow, God willing.",
      ],
      night: [
        "I'm packing. Unless you want this last gourd cheap.",
        "Night is for counting coin, not selling tomato.",
      ],
    },
    actions: [
      { id: "buy", label: "Buy produce", result: "Blessing weighs a handful into a nylon with a smile." },
      {
        id: "haggle",
        label: "Haggle produce (1 🐚)",
        kowryCost: 1,
        result: "She sighs, then adds one more pepper 'for your kitchen.'",
      },
      {
        id: "gossip",
        label: "Ask about the harvest",
        result: "Rain was kind upriver. Prices should ease next week — maybe.",
      },
    ],
  },
  {
    id: "master-obi",
    interiorId: "workplace",
    name: "Master Obi",
    role: "Carver & forge lead",
    skin: "#6b3f24",
    cloth: "#3d3d3d",
    position: [-1.0, 0, -1.5],
    facing: Math.PI * 0.9,
    lines: {
      morning: [
        "Hands first, talk later. The wood is softest before noon.",
        "A clean shift pays clean. A rushed shift pays hospital.",
      ],
      afternoon: [
        "Sweat is part of the wage. Drink, then cut with the grain.",
        "I need someone steady on the bench. You look almost steady.",
      ],
      evening: [
        "Evening light is kind to detail work. Or kind to mistakes — pick one.",
        "Practice costs shells. Skill returns them doubled, eventually.",
      ],
      night: [
        "Night forge is only for those who already know the tools.",
        "Come back at dawn if your hands shake.",
      ],
    },
    actions: [
      { id: "shift", label: "Take a paid shift", result: "Obi points at the bench. 'Show me clean cuts.'" },
      {
        id: "practice",
        label: "Practice craft (3 🐚)",
        kowryCost: 3,
        result: "Your hands learn the grain. Influence ticks up.",
      },
      {
        id: "gossip",
        label: "Ask about the trade",
        result: "He talks tools, timber, and which districts pay carvers well.",
      },
    ],
  },
];

export function npcsForInterior(id: InteriorId): InteriorNpcDef[] {
  return INTERIOR_NPCS.filter((n) => n.interiorId === id);
}

export function pickLine(npc: InteriorNpcDef, time: TimeOfDay, seed = 0): string {
  const lines = npc.lines[time] ?? npc.lines.afternoon;
  return lines[Math.abs(seed) % lines.length] ?? lines[0]!;
}
