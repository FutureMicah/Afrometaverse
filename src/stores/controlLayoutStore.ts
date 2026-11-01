/**
 * On-screen virtual control layout + live input state.
 * Positions are percentages of the play viewport (0–100).
 * Layout persists to localStorage.
 */

import { create } from "zustand";

export type ControlId =
  | "move"
  | "look"
  | "jump"
  | "sprint"
  | "crouch"
  | "interact"
  | "camera"
  | "fire"
  | "minimap";

export type ControlKind = "stick" | "button";

export type ControlDef = {
  id: ControlId;
  kind: ControlKind;
  label: string;
  /** Short label drawn on the button */
  glyph: string;
  /** Default left % */
  x: number;
  /** Default bottom % (we use bottom so thumbs stay near edges) */
  y: number;
  /** Diameter in px at scale 1 */
  baseSize: number;
  /** Visible by default */
  defaultVisible: boolean;
};

/** Catalogue of every control the player can place */
export const CONTROL_CATALOG: ControlDef[] = [
  { id: "move", kind: "stick", label: "Move", glyph: "◆", x: 12, y: 18, baseSize: 88, defaultVisible: true },
  { id: "look", kind: "stick", label: "Look", glyph: "◎", x: 78, y: 22, baseSize: 72, defaultVisible: false },
  { id: "jump", kind: "button", label: "Jump", glyph: "↑", x: 86, y: 14, baseSize: 48, defaultVisible: true },
  { id: "sprint", kind: "button", label: "Sprint", glyph: "⇢", x: 74, y: 10, baseSize: 44, defaultVisible: true },
  { id: "crouch", kind: "button", label: "Crouch", glyph: "↓", x: 86, y: 28, baseSize: 44, defaultVisible: true },
  { id: "interact", kind: "button", label: "Interact", glyph: "F", x: 74, y: 26, baseSize: 48, defaultVisible: true },
  { id: "camera", kind: "button", label: "Camera", glyph: "V", x: 62, y: 10, baseSize: 40, defaultVisible: true },
  { id: "fire", kind: "button", label: "Use gear", glyph: "●", x: 88, y: 42, baseSize: 44, defaultVisible: false },
  { id: "minimap", kind: "button", label: "Minimap", glyph: "M", x: 8, y: 42, baseSize: 40, defaultVisible: false },
];

export type PlacedControl = {
  id: ControlId;
  /** left % of viewport */
  x: number;
  /** bottom % of viewport */
  y: number;
  /** 0.55 – 1.6 multiplier on baseSize */
  scale: number;
  visible: boolean;
};

export type VirtualInputState = {
  /** -1 … 1 */
  moveX: number;
  moveZ: number;
  lookX: number;
  lookY: number;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  interact: boolean;
  camera: boolean;
  fire: boolean;
  minimap: boolean;
};

const STORAGE_KEY = "am-control-layout-v1";

function defaultLayout(): PlacedControl[] {
  return CONTROL_CATALOG.map((c) => ({
    id: c.id,
    x: c.x,
    y: c.y,
    scale: c.kind === "stick" ? 0.85 : 0.75,
    visible: c.defaultVisible,
  }));
}

function loadLayout(): PlacedControl[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLayout();
    const parsed = JSON.parse(raw) as PlacedControl[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultLayout();
    // Merge any new catalog ids the user doesn't have yet
    const byId = new Map(parsed.map((p) => [p.id, p]));
    return CONTROL_CATALOG.map((c) => {
      const existing = byId.get(c.id);
      if (existing) return { ...existing, id: c.id };
      return {
        id: c.id,
        x: c.x,
        y: c.y,
        scale: c.kind === "stick" ? 0.85 : 0.75,
        visible: c.defaultVisible,
      };
    });
  } catch {
    return defaultLayout();
  }
}

const emptyInput = (): VirtualInputState => ({
  moveX: 0,
  moveZ: 0,
  lookX: 0,
  lookY: 0,
  jump: false,
  sprint: false,
  crouch: false,
  interact: false,
  camera: false,
  fire: false,
  minimap: false,
});

interface ControlLayoutState {
  layout: PlacedControl[];
  /** When true, VirtualControls enter drag/edit mode */
  editMode: boolean;
  /** Show on-screen controls even on desktop */
  showVirtualControls: boolean;
  /** Opacity 0.25 – 1 */
  opacity: number;
  input: VirtualInputState;

  setEditMode: (v: boolean) => void;
  setShowVirtualControls: (v: boolean) => void;
  setOpacity: (v: number) => void;
  setControlPos: (id: ControlId, x: number, y: number) => void;
  setControlScale: (id: ControlId, scale: number) => void;
  setControlVisible: (id: ControlId, visible: boolean) => void;
  addControl: (id: ControlId) => void;
  removeControl: (id: ControlId) => void;
  resetLayout: () => void;
  persist: () => void;

  setAxis: (axis: "moveX" | "moveZ" | "lookX" | "lookY", value: number) => void;
  setButton: (btn: keyof Omit<VirtualInputState, "moveX" | "moveZ" | "lookX" | "lookY">, down: boolean) => void;
  clearInput: () => void;
}

export const useControlLayoutStore = create<ControlLayoutState>((set, get) => ({
  layout: typeof window !== "undefined" ? loadLayout() : defaultLayout(),
  editMode: false,
  showVirtualControls: true,
  opacity: 0.78,
  input: emptyInput(),

  setEditMode: (v) => set({ editMode: v }),
  setShowVirtualControls: (v) => set({ showVirtualControls: v }),
  setOpacity: (v) => set({ opacity: Math.min(1, Math.max(0.25, v)) }),

  setControlPos: (id, x, y) =>
    set((s) => ({
      layout: s.layout.map((c) =>
        c.id === id
          ? { ...c, x: Math.min(96, Math.max(2, x)), y: Math.min(90, Math.max(4, y)) }
          : c,
      ),
    })),

  setControlScale: (id, scale) =>
    set((s) => ({
      layout: s.layout.map((c) =>
        c.id === id ? { ...c, scale: Math.min(1.6, Math.max(0.55, scale)) } : c,
      ),
    })),

  setControlVisible: (id, visible) =>
    set((s) => ({
      layout: s.layout.map((c) => (c.id === id ? { ...c, visible } : c)),
    })),

  addControl: (id) =>
    set((s) => ({
      layout: s.layout.map((c) => (c.id === id ? { ...c, visible: true } : c)),
    })),

  removeControl: (id) =>
    set((s) => ({
      layout: s.layout.map((c) => (c.id === id ? { ...c, visible: false } : c)),
    })),

  resetLayout: () => {
    const layout = defaultLayout();
    set({ layout });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      /* ignore */
    }
  },

  persist: () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(get().layout));
    } catch {
      /* ignore */
    }
  },

  setAxis: (axis, value) =>
    set((s) => ({
      input: { ...s.input, [axis]: Math.max(-1, Math.min(1, value)) },
    })),

  setButton: (btn, down) =>
    set((s) => ({
      input: { ...s.input, [btn]: down },
    })),

  clearInput: () => set({ input: emptyInput() }),
}));

export function getControlDef(id: ControlId): ControlDef {
  return CONTROL_CATALOG.find((c) => c.id === id) ?? CONTROL_CATALOG[0];
}
