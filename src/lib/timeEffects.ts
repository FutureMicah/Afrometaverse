/**
 * Time-of-day and weather modifiers for economy, heat, patrols, and visibility.
 * Pure functions — safe to call every frame or on UI renders.
 */

import type { TimeOfDay, WeatherId } from "@/stores/weatherStore";

export type WorldModifiers = {
  /** Multiplies market prices (night stalls charge more) */
  priceMul: number;
  /** Multiplies job / mission payouts */
  jobMul: number;
  /** Multiplies heat gain from patrols */
  heatMul: number;
  /** Multiplies heat cool in safehouses */
  coolMul: number;
  /** Patrol detection radius scale */
  patrolRadiusMul: number;
  /** Patrol move speed scale */
  patrolSpeedMul: number;
  /** Foot move speed scale (night slightly careful) */
  moveMul: number;
  /** Short label for HUD */
  vibe: string;
};

export function worldModifiers(
  timeOfDay: TimeOfDay,
  weatherId: WeatherId,
  hour: number,
): WorldModifiers {
  let priceMul = 1;
  let jobMul = 1;
  let heatMul = 1;
  let coolMul = 1;
  let patrolRadiusMul = 1;
  let patrolSpeedMul = 1;
  let moveMul = 1;
  let vibe = "Day trade is open";

  switch (timeOfDay) {
    case "morning":
      priceMul = 0.95;
      jobMul = 1.08;
      coolMul = 1.1;
      vibe = "Morning cool — good for honest work";
      break;
    case "afternoon":
      priceMul = 1.05;
      jobMul = 1.0;
      heatMul = 1.05;
      moveMul = 0.98;
      vibe = "Heat climbs — market is loud";
      break;
    case "evening":
      priceMul = 1.12;
      jobMul = 1.05;
      heatMul = 1.15;
      patrolRadiusMul = 1.1;
      patrolSpeedMul = 1.08;
      vibe = "Evening lamps — grey jobs pay more";
      break;
    case "night":
      priceMul = 1.22;
      jobMul = 1.18;
      heatMul = 1.35;
      coolMul = 0.85;
      patrolRadiusMul = 1.35;
      patrolSpeedMul = 1.2;
      moveMul = 0.94;
      vibe = "Night watch — more heat, higher risk pay";
      break;
  }

  if (weatherId === "rainy") {
    moveMul *= 0.92;
    patrolRadiusMul *= 0.9;
    coolMul *= 1.15;
    vibe = timeOfDay === "night" ? "Rainy night — streets slick" : "Rain on zinc — trade slows";
  } else if (weatherId === "harmattan") {
    patrolRadiusMul *= 0.85; // dust hides you a little
    heatMul *= 0.95;
    priceMul *= 1.08;
    vibe = "Harmattan haze — dust on every deal";
  }

  // Deep night spike 23:00–4:00
  const h = ((hour % 24) + 24) % 24;
  if (h >= 23 || h < 4) {
    heatMul *= 1.15;
    jobMul *= 1.1;
    patrolSpeedMul *= 1.1;
  }

  return {
    priceMul,
    jobMul,
    heatMul,
    coolMul,
    patrolRadiusMul,
    patrolSpeedMul,
    moveMul,
    vibe,
  };
}

/** Format in-game hour as 12h clock string */
export function formatGameClock(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const hr = Math.floor(h);
  const min = Math.floor((h - hr) * 60);
  const ap = hr >= 12 ? "PM" : "AM";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${h12}:${min.toString().padStart(2, "0")} ${ap}`;
}
