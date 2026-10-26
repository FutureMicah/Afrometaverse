// Abstract combat input. Keyboard, gamepad and mobile touch all emit these same objects into dispatchInput.
// Mobile hook: a touch layer maps its buttons and joystick to CombatInput (see TOUCH_LAYOUT).

export type ButtonPhase = "down" | "up";
export type WeaponSlotNum = 1 | 2 | 3 | 4;

export type CombatInput =
  | { type: "lightAttack"; phase: ButtonPhase }
  | { type: "heavyAttack"; phase: ButtonPhase }
  | { type: "block"; phase: ButtonPhase }
  | { type: "dodge"; phase: ButtonPhase }
  | { type: "move"; x: number; z: number }
  | { type: "weapon"; slot: WeaponSlotNum };

export type ButtonInputType = "lightAttack" | "heavyAttack" | "block" | "dodge";

/** Keyboard bindings from spec 8.2: J/LMB light, K/RMB heavy, Q block, Space dodge, 1 to 4 weapon swap. */
export const KEY_BUTTONS: Record<string, ButtonInputType> = {
  j: "lightAttack",
  k: "heavyAttack",
  q: "block",
  " ": "dodge",
};

export const KEY_MOVE: Record<string, [number, number]> = {
  w: [0, 1],
  s: [0, -1],
  a: [-1, 0],
  d: [1, 0],
};

export const KEY_WEAPON: Record<string, WeaponSlotNum> = { "1": 1, "2": 2, "3": 3, "4": 4 };

/** Touch layout the mobile controls will fill in later. Each entry names the CombatInput it emits. */
export const TOUCH_LAYOUT = [
  { id: "joystick", emits: "move" },
  { id: "light", emits: "lightAttack", hold: false },
  { id: "heavy", emits: "heavyAttack", hold: true },
  { id: "block", emits: "block", hold: true },
  { id: "dodge", emits: "dodge", hold: false },
  { id: "weapon-1..4", emits: "weapon" },
] as const;

/** Tracks held move keys and returns the current move vector from WASD. */
export function moveFromKeys(held: Set<string>): { x: number; z: number } {
  let x = 0;
  let z = 0;
  held.forEach((k) => {
    const v = KEY_MOVE[k];
    if (v) {
      x += v[0];
      z += v[1];
    }
  });
  return { x: Math.max(-1, Math.min(1, x)), z: Math.max(-1, Math.min(1, z)) };
}

/**
 * Attach keyboard controls to a target. Returns a detach function.
 * Ignores key repeat and keys typed into form fields.
 */
export function attachKeyboard(target: Window, dispatch: (i: CombatInput) => void): () => void {
  const held = new Set<string>();
  const isTyping = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  };
  const onDown = (e: KeyboardEvent) => {
    if (isTyping(e) || e.repeat) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const btn = KEY_BUTTONS[k];
    if (btn) {
      e.preventDefault();
      dispatch({ type: btn, phase: "down" } as CombatInput);
      return;
    }
    const slot = KEY_WEAPON[k];
    if (slot) {
      dispatch({ type: "weapon", slot });
      return;
    }
    if (KEY_MOVE[k]) {
      held.add(k);
      const m = moveFromKeys(held);
      dispatch({ type: "move", x: m.x, z: m.z });
    }
  };
  const onUp = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const btn = KEY_BUTTONS[k];
    if (btn) {
      dispatch({ type: btn, phase: "up" } as CombatInput);
      return;
    }
    if (KEY_MOVE[k]) {
      held.delete(k);
      const m = moveFromKeys(held);
      dispatch({ type: "move", x: m.x, z: m.z });
    }
  };
  target.addEventListener("keydown", onDown);
  target.addEventListener("keyup", onUp);
  return () => {
    target.removeEventListener("keydown", onDown);
    target.removeEventListener("keyup", onUp);
  };
}
