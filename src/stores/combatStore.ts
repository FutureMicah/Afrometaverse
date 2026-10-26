import { create } from "zustand";
import type { AttackPhase } from "@/systems/combat/combatTypes";
import type { WeaponSlot } from "@/systems/combat/weapons";

/** A damage or feedback event shown on screen. Ring buffer capped in the store. */
export interface CombatFeedEvent {
  id: number;
  kind: string;
  x: number;
  z: number;
  amount: number;
  critical: boolean;
  atMs: number;
}

export const FEED_CAP = 40;

interface CombatState {
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  winded: boolean;
  equippedSlot: WeaponSlot;
  phase: AttackPhase;
  cooldownMs: number;
  dead: boolean;
  feed: CombatFeedEvent[];
  feedSeq: number;
  setSlot: (slot: WeaponSlot) => void;
  pushFeed: (ev: Omit<CombatFeedEvent, "id">) => void;
  clearFeed: () => void;
  /** Sync snapshot from the world tick. Only writes when a field changed. */
  syncVitals: (v: Partial<Omit<CombatState, "setSlot" | "pushFeed" | "clearFeed" | "syncVitals" | "feed" | "feedSeq">>) => void;
}

export const useCombatStore = create<CombatState>()((set) => ({
  health: 100,
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  winded: false,
  equippedSlot: 1,
  phase: "idle",
  cooldownMs: 0,
  dead: false,
  feed: [],
  feedSeq: 0,
  setSlot: (slot) => set({ equippedSlot: slot }),
  pushFeed: (ev) =>
    set((s) => {
      const id = s.feedSeq + 1;
      const next = [...s.feed, { ...ev, id }];
      if (next.length > FEED_CAP) next.splice(0, next.length - FEED_CAP);
      return { feed: next, feedSeq: id };
    }),
  clearFeed: () => set({ feed: [] }),
  syncVitals: (v) => set(v as Partial<CombatState>),
}));
