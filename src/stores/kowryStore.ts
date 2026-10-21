/**
 * Day 7 foundation — KOWRY (KWRY) heritage currency
 * Shell-based play currency; MetaNaira reserved for later conversion layer.
 */

import { create } from "zustand";

export type KowryLedgerReason =
  | "mission"
  | "trade"
  | "barter"
  | "dividend"
  | "harvest"
  | "mentor"
  | "spend"
  | "grant";

interface LedgerEntry {
  id: string;
  amount: number;
  reason: KowryLedgerReason;
  note?: string;
  at: number;
}

interface KowryState {
  balance: number;
  metaNairaMined: number;
  influenceScore: number;
  ledger: LedgerEntry[];
  earn: (amount: number, reason: KowryLedgerReason, note?: string) => void;
  spend: (amount: number, reason: KowryLedgerReason, note?: string) => boolean;
  addInfluence: (points: number) => void;
  mineMetaNaira: (amount: number) => void;
  resetWallet: () => void;
}

const MAX_LEDGER = 40;

export const useKowryStore = create<KowryState>((set, get) => ({
  balance: 25, // starter shells
  metaNairaMined: 0,
  influenceScore: 0,
  ledger: [],

  earn: (amount, reason, note) => {
    if (amount <= 0) return;
    const entry: LedgerEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amount,
      reason,
      note,
      at: Date.now(),
    };
    set((s) => ({
      balance: s.balance + amount,
      ledger: [entry, ...s.ledger].slice(0, MAX_LEDGER),
    }));
  },

  spend: (amount, reason, note) => {
    const { balance } = get();
    if (amount <= 0 || balance < amount) return false;
    const entry: LedgerEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amount: -amount,
      reason,
      note,
      at: Date.now(),
    };
    set((s) => ({
      balance: s.balance - amount,
      ledger: [entry, ...s.ledger].slice(0, MAX_LEDGER),
    }));
    return true;
  },

  addInfluence: (points) =>
    set((s) => ({ influenceScore: Math.max(0, s.influenceScore + points) })),

  mineMetaNaira: (amount) =>
    set((s) => ({ metaNairaMined: s.metaNairaMined + Math.max(0, amount) })),

  resetWallet: () =>
    set({ balance: 25, metaNairaMined: 0, influenceScore: 0, ledger: [] }),
}));

/** Simple XP → KOWRY payout helper from Economy & Tribal Trades doc */
export function calculateEarnings(baseXP: number, role: "farmer" | "hunter" | "trader" | "builder" | "herbalist") {
  const roleMult: Record<typeof role, number> = {
    farmer: 1.0,
    hunter: 1.15,
    trader: 1.25,
    builder: 1.1,
    herbalist: 1.2,
  };
  return Math.round(baseXP * 0.08 * roleMult[role]);
}
