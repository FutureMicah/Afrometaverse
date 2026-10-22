/**
 * Sky, sun, moon, fog and light values for an in-game hour and season.
 * Pure data: the renderer applies these, tests check them.
 */

import { sunSignal, nightStrength } from "./worldClock";
import type { SeasonId } from "./seasons";

export interface AtmosphereState {
  skyTop: string;
  skyBottom: string;
  fog: string;
  sunColor: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  moonPosition: [number, number, number];
  moonVisible: boolean;
  ambientIntensity: number;
  hemiIntensity: number;
  hemiSky: string;
  starOpacity: number;
  fogNear: number;
  fogFar: number;
}

interface Keyframe {
  hour: number;
  top: string;
  bottom: string;
  ambient: number;
}

// Hour keyframes. 24 wraps to 0. Night is deep blue-black but never below the ambient floor.
const KEYFRAMES: Keyframe[] = [
  { hour: 0, top: "#060a16", bottom: "#0e1628", ambient: 0.22 },
  { hour: 5, top: "#2a3558", bottom: "#e88a4a", ambient: 0.38 },
  { hour: 7, top: "#8fb8d8", bottom: "#ffd9a0", ambient: 0.62 },
  { hour: 12, top: "#7fb4e0", bottom: "#e6f2f7", ambient: 0.75 },
  { hour: 16, top: "#9bc0d6", bottom: "#f2d29a", ambient: 0.68 },
  { hour: 18.5, top: "#5b3a6b", bottom: "#ff7a2e", ambient: 0.4 },
  { hour: 20, top: "#0a0f1e", bottom: "#111a2e", ambient: 0.22 },
  { hour: 24, top: "#060a16", bottom: "#0e1628", ambient: 0.22 },
];

export const NIGHT_AMBIENT_FLOOR = 0.22;
export const MOON_COLOR = "#9eb6ff";
export const NIGHT_GROUND = "#1a1f2e";
export const DAY_GROUND = "#7a5a32";

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(rgb: [number, number, number]): string {
  return "#" + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
}

function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

function desaturate(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = 0.3 * r + 0.59 * g + 0.11 * b;
  return rgbToHex([r + (lum - r) * amount, g + (lum - g) * amount, b + (lum - b) * amount]);
}

function skyKeysAt(hour: number): { top: string; bottom: string; ambient: number } {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const a = KEYFRAMES[i] as Keyframe;
    const b = KEYFRAMES[i + 1] as Keyframe;
    if (h >= a.hour && h <= b.hour) {
      const t = (h - a.hour) / (b.hour - a.hour || 1);
      return {
        top: mixHex(a.top, b.top, t),
        bottom: mixHex(a.bottom, b.bottom, t),
        ambient: a.ambient + (b.ambient - a.ambient) * t,
      };
    }
  }
  const first = KEYFRAMES[0] as Keyframe;
  return { top: first.top, bottom: first.bottom, ambient: first.ambient };
}

/** Season tint. Harmattan is dusty and cool, rain is overcast, dry is golden haze. */
const SEASON_TINT: Record<SeasonId, { sunTint: string; sunMul: number; ambientMul: number; desat: number; haze: string; hazeMix: number; fogFarMul: number }> = {
  rain: { sunTint: "#c8ccd2", sunMul: 0.45, ambientMul: 0.9, desat: 0.5, haze: "#6f7680", hazeMix: 0.35, fogFarMul: 0.8 },
  harvest: { sunTint: "#ffe6b0", sunMul: 1.0, ambientMul: 1.0, desat: 0.05, haze: "#d9b67a", hazeMix: 0.15, fogFarMul: 1.0 },
  harmattan: { sunTint: "#d8e4ec", sunMul: 0.85, ambientMul: 0.95, desat: 0.35, haze: "#b9b1a0", hazeMix: 0.4, fogFarMul: 0.5 },
  dry: { sunTint: "#ffd9a0", sunMul: 1.0, ambientMul: 1.0, desat: 0.1, haze: "#d9b67a", hazeMix: 0.25, fogFarMul: 0.85 },
};

export function atmosphereAt(hour: number, season: SeasonId, renderRadiusMeters: number, dustIntensity = 0): AtmosphereState {
  const keys = skyKeysAt(hour);
  const tint = SEASON_TINT[season];
  const s = sunSignal(hour);
  const night = nightStrength(hour);

  let top = desaturate(keys.top, tint.desat);
  let bottom = desaturate(keys.bottom, tint.desat);
  top = mixHex(top, tint.haze, tint.hazeMix * 0.5);
  bottom = mixHex(bottom, tint.haze, tint.hazeMix);
  const fog = mixHex(bottom, tint.haze, tint.hazeMix * 0.5);

  // Sun: harsh at midday, warm at dawn and dusk, zero below the horizon.
  const sunI = Math.max(0, s) ** 0.7 * 1.45 * tint.sunMul;
  const sunColor = tint.sunTint;
  const angle = ((((hour - 6) / 24) % 1) * Math.PI * 2);
  const R = 40;
  const sunPosition: [number, number, number] = [Math.cos(angle) * R, Math.sin(angle) * R, 16];
  const moonPosition: [number, number, number] = [-Math.cos(angle) * R, -Math.sin(angle) * R, -16];

  // Ambient never drops below the night floor, so the village stays navigable at night.
  const ambient = Math.max(NIGHT_AMBIENT_FLOOR, keys.ambient * tint.ambientMul);
  const moonI = night * 0.18;

  const hemiSky = mixHex(desaturate("#dfe8f0", tint.desat), MOON_COLOR, night);
  const hemiIntensity = 0.5 * (0.6 + night * 0.4) + moonI;

  const dustFogMul = 1 - Math.min(1, Math.max(0, dustIntensity)) * 0.4;
  const fogFar = Math.max(20, renderRadiusMeters * tint.fogFarMul * dustFogMul);

  return {
    skyTop: top,
    skyBottom: bottom,
    fog,
    sunColor,
    sunIntensity: sunI,
    sunPosition,
    moonPosition,
    moonVisible: night > 0.2,
    ambientIntensity: ambient,
    hemiIntensity,
    hemiSky,
    starOpacity: night,
    fogNear: fogFar * 0.3,
    fogFar,
  };
}
