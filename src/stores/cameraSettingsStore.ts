/**
 * Camera & look settings — sensitivity, invert, FOV, first-person body visibility.
 * Persists to localStorage.
 */

import { create } from "zustand";

const STORAGE_KEY = "am-camera-settings-v1";

export type CameraSettings = {
  /** Mouse / look drag multiplier (0.4 – 2.5). 1 = default. */
  lookSensitivity: number;
  /** Touch look drag multiplier (0.4 – 2.5). */
  touchSensitivity: number;
  invertY: boolean;
  /** Base third-person FOV */
  tpsFov: number;
  /** Base first-person FOV */
  fpsFov: number;
  /** Show swinging hands + legs in first-person */
  showFpsBody: boolean;
  /** How much of the lower body appears when looking down (0–1) */
  fpsLegVisibility: number;
};

const defaults: CameraSettings = {
  lookSensitivity: 1,
  touchSensitivity: 1,
  invertY: false,
  tpsFov: 48,
  fpsFov: 68,
  showFpsBody: true,
  fpsLegVisibility: 1,
};

function load(): CameraSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

interface CameraSettingsState extends CameraSettings {
  setLookSensitivity: (v: number) => void;
  setTouchSensitivity: (v: number) => void;
  setInvertY: (v: boolean) => void;
  setTpsFov: (v: number) => void;
  setFpsFov: (v: number) => void;
  setShowFpsBody: (v: boolean) => void;
  setFpsLegVisibility: (v: number) => void;
  resetCamera: () => void;
  persist: () => void;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export const useCameraSettingsStore = create<CameraSettingsState>((set, get) => {
  const initial = typeof window !== "undefined" ? load() : { ...defaults };
  return {
    ...initial,
    setLookSensitivity: (v) => set({ lookSensitivity: clamp(v, 0.35, 2.6) }),
    setTouchSensitivity: (v) => set({ touchSensitivity: clamp(v, 0.35, 2.6) }),
    setInvertY: (v) => set({ invertY: v }),
    setTpsFov: (v) => set({ tpsFov: clamp(v, 35, 75) }),
    setFpsFov: (v) => set({ fpsFov: clamp(v, 50, 100) }),
    setShowFpsBody: (v) => set({ showFpsBody: v }),
    setFpsLegVisibility: (v) => set({ fpsLegVisibility: clamp(v, 0, 1) }),
    resetCamera: () => {
      set({ ...defaults });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      } catch {
        /* ignore */
      }
    },
    persist: () => {
      const s = get();
      const payload: CameraSettings = {
        lookSensitivity: s.lookSensitivity,
        touchSensitivity: s.touchSensitivity,
        invertY: s.invertY,
        tpsFov: s.tpsFov,
        fpsFov: s.fpsFov,
        showFpsBody: s.showFpsBody,
        fpsLegVisibility: s.fpsLegVisibility,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    },
  };
});
