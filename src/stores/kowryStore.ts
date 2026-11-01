/**
 * Day 7 foundation — KOWRY (KWRY) heritage currency
 * Shell-based play currency; MetaNaira reserved for later conversion layer.
 */

import { create } from "zustand";

const STORAGE_KEY = "am-kowry-v1";

function loadKowry(): { balance: number; metaNairaMined: number; influenceScore: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { balance: 40, metaNairaMined: 0, influenceScore: 0 };
    const p = JSON.parse(raw);
    return {
      balance: typeof p.balance === "number" ? p.balance : 40,
      metaNairaMined: typeof p.metaNairaMined === "number" ? p.metaNairaMined : 0,
      influenceScore: typeof p.influenceScore === "number" ? p.influenceScore : 0,
    };
  } catch {
    return { balance: 40, metaNairaMined: 0, influenceScore: 0 };
  }
}

function persistKowry(s: { balance: number; metaNairaMined: number; influenceScore: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      balance: s.balance,
      metaNairaMined: s.metaNairaMined,
      influenceScore: s.influenceScore,
    }));
  } catch { /* ignore */ }
}

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

const initial = typeof window !== "undefined" ? loadKowry() : { balance: 40, metaNairaMined: 0, influenceScore: 0 };

export const useKowryStore = create<KowryState>((set, get) => ({
  balance: initial.balance,
  metaNairaMined: initial.metaNairaMined,
  influenceScore: initial.influenceScore,
  ledger: [],

  earn: (amount, reason, note) => {
    if (amount <= 0) return;
    const entry: LedgerEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amount,
      reason,
      ...(note !== undefined ? { note } : {}),
      at: Date.now(),
    };
    set((s) => {
      const next = {
        balance: s.balance + amount,
        ledger: [entry, ...s.ledger].slice(0, MAX_LEDGER),
      };
      persistKowry({ balance: next.balance, metaNairaMined: s.metaNairaMined, influenceScore: s.influenceScore });
      return next;
    });
  },

  spend: (amount, reason, note) => {
    const { balance } = get();
    if (amount <= 0 || balance < amount) return false;
    const entry: LedgerEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amount: -amount,
      reason,
      ...(note !== undefined ? { note } : {}),
      at: Date.now(),
    };
    set((s) => {
      const next = {
        balance: s.balance - amount,
        ledger: [entry, ...s.ledger].slice(0, MAX_LEDGER),
      };
      persistKowry({ balance: next.balance, metaNairaMined: s.metaNairaMined, influenceScore: s.influenceScore });
      return next;
    });
    return true;
  },

  addInfluence: (points) =>
    set((s) => ({ influenceScore: Math.max(0, s.influenceScore + points) })),

  mineMetaNaira: (amount) =>
    set((s) => ({ metaNairaMined: s.metaNairaMined + Math.max(0, amount) })),

  resetWallet: () => {
    const next = { balance: 40, metaNairaMined: 0, influenceScore: 0, ledger: [] as LedgerEntry[] };
    persistKowry(next);
    set(next);
  },
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
