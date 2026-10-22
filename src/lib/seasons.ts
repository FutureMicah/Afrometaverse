/**
 * Tier 1 seasons (era-progression-spec.md 12.2.2).
 * A 112-day year of four 28-day seasons. Day 1 is the first day of the rain season (April).
 * Order: rain (Apr-Jul), harvest (Aug-Oct), harmattan (Nov-Feb), dry (late Feb-Mar).
 */

export const SEASON_LENGTH_DAYS = 28;
export const SEASON_YEAR_DAYS = 112;

export type SeasonId = "rain" | "harvest" | "harmattan" | "dry";
export type WeatherId = "dry" | "rainy" | "harmattan";

const SEASON_ORDER: SeasonId[] = ["rain", "harvest", "harmattan", "dry"];

/** Which weather presentation each season uses. Harvest is a dry, bright season. */
const SEASON_WEATHER: Record<SeasonId, WeatherId> = {
  rain: "rainy",
  harvest: "dry",
  harmattan: "harmattan",
  dry: "dry",
};

/** Day of the 112-day year, 1-based, wrapping every year. */
export function dayOfYear(day: number): number {
  const d = Math.floor(day);
  return ((((d - 1) % SEASON_YEAR_DAYS) + SEASON_YEAR_DAYS) % SEASON_YEAR_DAYS) + 1;
}

export function seasonForDay(day: number): SeasonId {
  const index = Math.floor((dayOfYear(day) - 1) / SEASON_LENGTH_DAYS);
  return SEASON_ORDER[index] ?? "rain";
}

export function weatherForSeason(season: SeasonId): WeatherId {
  return SEASON_WEATHER[season];
}

export function weatherForDay(day: number): WeatherId {
  return weatherForSeason(seasonForDay(day));
}
