/**
 * Lobby 3D palette. Three.js cannot read oklch CSS tokens, so the scene colours live here
 * and the HUD chrome uses the am-* tokens in lobby.css. Keep these in sync with the warm
 * night theme: ember orange, torch gold, deep indigo sky, red moon.
 */
export const LOBBY_PALETTE = {
  sky: "#0c0a14",
  haze: "#241826",
  ground: "#1a1410",
  hutWall: "#2a1c14",
  thatch: "#3a2a1a",
  torch: "#ffa33b",
  ember: "#ff7a2e",
  window: "#ffb85c",
  moon: "#b5452b",
  rim: "#e0733e",
} as const;
