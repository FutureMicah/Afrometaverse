/**
 * In-game clock. One in-game day spans `dayMinutes` real minutes (default 24).
 * Pure functions only, so the stores and the renderer share the same rules.
 */

export const DEFAULT_DAY_MINUTES = 24;
export const DEFAULT_START_HOUR = 7;

export type TimeOfDayKey = "morning" | "afternoon" | "evening" | "night";

/** Advance an in-game hour (0 to 24) by real seconds elapsed. */
export function advanceHour(hour: number, realSeconds: number, dayMinutes = DEFAULT_DAY_MINUTES): number {
  if (!(dayMinutes > 0) || !Number.isFinite(realSeconds)) return hour;
  const hoursPerSecond = 24 / (dayMinutes * 60);
  const next = (hour + realSeconds * hoursPerSecond) % 24;
  return next < 0 ? next + 24 : next;
}

/** Map an in-game hour to the coarse bucket used by the HUD and events. */
export function timeKeyForHour(hour: number): TimeOfDayKey {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 16) return "afternoon";
  if (h >= 16 && h < 20) return "evening";
  return "night";
}

/** Sun elevation signal: +1 at noon, 0 at 06:00 and 18:00, -1 at midnight. */
export function sunSignal(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  return Math.sin(((h - 6) / 24) * Math.PI * 2);
}

/** Night strength 0 (full day) to 1 (deep night), used for stars and moon. */
export function nightStrength(hour: number): number {
  return Math.min(1, Math.max(0, -sunSignal(hour) * 3));
}
