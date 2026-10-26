/**
 * Lobby 3D palette. Three.js cannot read oklch CSS tokens, so the scene colours live here
 * and the HUD chrome uses the am-* tokens in lobby.css. Keep these in sync with the
 * dusk theme: warm amber sky, low orange sun, lit torches and windows.
 */
export const LOBBY_PALETTE = {
  sky: "#c97a3e",
  haze: "#e8a06a",
  ground: "#6b4a2e",
  hutWall: "#7a5232",
  thatch: "#8a6538",
  torch: "#ffa33b",
  ember: "#ff7a2e",
  window: "#ffc266",
  moon: "#ffd9a0",
  rim: "#ff9a4d",
} as const;
