import { create } from "zustand";

/** Live face proxy weights (0–1), ARKit-compatible semantics */
export type FaceProxyLive = {
  blinkL: number;
  blinkR: number;
  jawOpen: number;
  browUp: number;
  smile: number;
  /** Head euler approx from tracker (radians) */
  headYaw: number;
  headPitch: number;
  headRoll: number;
};

type FaceTrackState = {
  enabled: boolean;
  tracking: boolean;
  error: string | null;
  proxy: FaceProxyLive;
  setEnabled: (v: boolean) => void;
  setTracking: (v: boolean) => void;
  setError: (e: string | null) => void;
  setProxy: (p: Partial<FaceProxyLive>) => void;
  resetProxy: () => void;
};

const ZERO: FaceProxyLive = {
  blinkL: 0,
  blinkR: 0,
  jawOpen: 0,
  browUp: 0,
  smile: 0,
  headYaw: 0,
  headPitch: 0,
  headRoll: 0,
};

export const useFaceTrackStore = create<FaceTrackState>((set) => ({
  enabled: false,
  tracking: false,
  error: null,
  proxy: { ...ZERO },
  setEnabled: (enabled) => set({ enabled, ...(enabled ? {} : { tracking: false, proxy: { ...ZERO } }) }),
  setTracking: (tracking) => set({ tracking }),
  setError: (error) => set({ error }),
  setProxy: (p) => set((s) => ({ proxy: { ...s.proxy, ...p } })),
  resetProxy: () => set({ proxy: { ...ZERO } }),
}));
