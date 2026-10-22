/**
 * Interior weather (era-progression-spec.md 17). Pure rules only: the store and the
 * renderer call these so the numbers are testable without a browser.
 *
 * A hut has apertures (its door and its window shutter). Each one has an open
 * amount (0 shut, 1 fully open) and a latch. Wind never moves a latched aperture.
 */

export interface Aperture {
  /** 0 = shut, 1 = fully open. */
  open: number;
  /** Bolted from inside. Only possible when shut. */
  latched: boolean;
}

export type ApertureName = "door" | "shutter";

export interface RoomApertures {
  door: Aperture;
  shutter: Aperture;
}

/** Wind speed where the storm starts to push on apertures, and where it is at full strength. */
const WIND_CALM = 2;
const WIND_FULL = 8;
/** Gusts below this strength do not push or rattle anything (17.3). */
export const BLOW_THRESHOLD = 0.3;
/** Opening speed of a door or shutter already ajar, per second at full wind (17.3). */
const PUSH_RATE = 0.5;
/** Crack opened by a shut aperture when a gust catches it (17.3). */
const CRACK = 0.05;
/** Chance per second of a shut aperture blowing open, at full wind (0.2 x strength squared). */
const BLOW_CHANCE = 0.2;
/** Wetness gained per second per unit of rain x open fraction (17.5). */
const WET_RATE = 0.05;
/** Wetness lost per second when no rain comes in (17.5). */
const DRY_RATE = 0.02;

export const DEFAULT_DOOR: Aperture = { open: 1, latched: false };
export const DEFAULT_SHUTTER: Aperture = { open: 0, latched: false };

export function defaultApertures(): RoomApertures {
  return { door: { ...DEFAULT_DOOR }, shutter: { ...DEFAULT_SHUTTER } };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Wind strength 0 (calm) to 1 (full gale), from the weather's windSpeed (17.2). */
export function windStrength(windSpeed: number): number {
  if (!Number.isFinite(windSpeed)) return 0;
  return clamp01((windSpeed - WIND_CALM) / (WIND_FULL - WIND_CALM));
}

/** Mean open amount over the room's apertures: how much of the room is open to the weather. */
export function openFraction(apertures: Aperture[]): number {
  if (apertures.length === 0) return 0;
  return apertures.reduce((sum, a) => sum + clamp01(a.open), 0) / apertures.length;
}

export interface StepResult {
  apertures: Aperture[];
  /** Indexes of apertures that went from shut to open this step (drives the clack sound). */
  blownOpen: number[];
}

/**
 * Advance the wind's effect on the apertures by dt seconds.
 * `roll` returns a number in [0, 1); pass Math.random in the game and a fixed value in tests.
 */
export function stepApertures(
  apertures: Aperture[],
  strength: number,
  dt: number,
  roll: () => number,
): StepResult {
  const s = clamp01(strength);
  const blownOpen: number[] = [];
  const next = apertures.map((a, i) => {
    if (a.latched || s < BLOW_THRESHOLD || !(dt > 0)) return { ...a };
    let open = clamp01(a.open);
    if (open === 0) {
      const chance = BLOW_CHANCE * s * s * dt;
      if (roll() < chance) {
        open = CRACK;
        blownOpen.push(i);
      } else {
        return { ...a };
      }
    }
    if (open > 0 && open < 1) {
      open = clamp01(open + PUSH_RATE * s * dt);
    }
    return { open, latched: a.latched };
  });
  return { apertures: next, blownOpen };
}

/** Rattle amplitude (17.3): only a shut, unlatched aperture rattles, scaled by wind. */
export function rattleAmplitude(a: Aperture, strength: number): number {
  if (a.latched || clamp01(a.open) > 0) return 0;
  return clamp01(strength) * 0.6;
}

/** Wind audio level (17.4). A sealed room is nearly silent in a storm. */
export function windAudioGain(strength: number, openFrac: number): number {
  return clamp01(strength) * (0.2 + 0.8 * clamp01(openFrac));
}

/** Rain audio level (17.4). Muffled on a roof, loud through an open door. */
export function rainAudioGain(rainIntensity: number, openFrac: number): number {
  return clamp01(rainIntensity) * (0.1 + 0.9 * clamp01(openFrac));
}

/** Draft chill (17.5): how much cold air the open room lets in, 0 to 1. */
export function draftChill(strength: number, openFrac: number): number {
  return clamp01(strength) * clamp01(openFrac);
}

/** Floor wetness (17.5). Rain through open apertures wets the floor; it dries slowly otherwise. */
export function stepWetness(wetness: number, rainIntensity: number, openFrac: number, dt: number): number {
  if (!(dt > 0)) return clamp01(wetness);
  const inflow = clamp01(rainIntensity) * clamp01(openFrac) * WET_RATE;
  const change = inflow > 0 ? inflow * dt : -DRY_RATE * dt;
  return clamp01(wetness + change);
}

/** Player actions on one aperture (17.1). Each returns a new aperture. */
export const apertureActions = {
  close: (a: Aperture): Aperture => ({ open: 0, latched: a.latched }),
  latch: (a: Aperture): Aperture => (clamp01(a.open) === 0 ? { open: 0, latched: true } : { ...a }),
  unlatch: (a: Aperture): Aperture => ({ open: a.open, latched: false }),
  open: (): Aperture => ({ open: 1, latched: false }),
};

export type ApertureAction = keyof typeof apertureActions;
