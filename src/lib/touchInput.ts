/**
 * Shared touch input state for the roam player. Written by TouchControls (DOM pointer
 * events) and read every frame by PlayerController in AfroMetaverseScene. Kept as a plain
 * mutable object so touch movement never triggers React re-renders.
 *
 * move: joystick vector, x = right (+), y = down (+), matching the S key being +z.
 * look: camera drag accumulated since the last frame, in CSS px (same units as movementX/Y).
 * viewToggles: counter bumped by the V button; the scene compares it to toggle first/third person.
 */
export const touchInput = {
  move: { x: 0, y: 0 },
  sprint: false,
  crouch: false,
  jump: false,
  lookDx: 0,
  lookDy: 0,
  viewToggles: 0,
};

/** Returns the pending camera drag and clears it. */
export function takeTouchLook(): { dx: number; dy: number } {
  const dx = touchInput.lookDx;
  const dy = touchInput.lookDy;
  touchInput.lookDx = 0;
  touchInput.lookDy = 0;
  return { dx, dy };
}

export function resetTouchInput() {
  touchInput.move.x = 0;
  touchInput.move.y = 0;
  touchInput.sprint = false;
  touchInput.crouch = false;
  touchInput.jump = false;
  touchInput.lookDx = 0;
  touchInput.lookDy = 0;
}
