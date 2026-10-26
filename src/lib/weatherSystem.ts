/**
 * Visual weather state machine (pure rules, no three.js).
 *
 * States: clear, harmattan haze, light rain, thunderstorm, dry-season heat.
 * Each state is a target set of numbers. The live blend eases toward the current
 * state's target every frame, so nothing swaps instantly. Moving between states that
 * are not neighbours walks through the graph one hop at a time (for example
 * harmattan to storm goes harmattan, clear, rain, storm).
 */

export type VisualWeatherId = "clear" | "harmattan" | "rain" | "storm" | "heat";

export const VISUAL_WEATHER_IDS: readonly VisualWeatherId[] = ["clear", "harmattan", "rain", "storm", "heat"];

export const VISUAL_WEATHER_LABELS: Record<VisualWeatherId, string> = {
  clear: "Clear",
  harmattan: "Harmattan",
  rain: "Light rain",
  storm: "Thunderstorm",
  heat: "Dry heat",
};

/** Numeric visual parameters. Every field is 0..1 unless noted. */
export interface WeatherParams {
  /** Rain streak density. */
  rain: number;
  /** Airborne dust and haze density. */
  dust: number;
  /** Cloud cover. */
  cloud: number;
  /** Sky and cloud darkening (grey). */
  darkness: number;
  /** Wind strength (visual and gust driver). */
  wind: number;
  /** Storm strength, drives gust events. */
  storm: number;
  /** Sun intensity multiplier. */
  sun: number;
  /** Warm haze bank opacity near the horizon. */
  haze: number;
  /** Draw distance multiplier on the fog far plane. */
  drawDistance: number;
  /** Ground wetness. */
  wet: number;
  /** Heat shimmer amount (drives the exposure pulse). */
  shimmer: number;
  /** Exposure multiplier. */
  exposure: number;
  /** Bleached light: desaturates sky and sun. */
  bleach: number;
  /** Warm tint on fog. */
  fogWarm: number;
}

export const WEATHER_TARGETS: Record<VisualWeatherId, WeatherParams> = {
  clear: {
    rain: 0, dust: 0.05, cloud: 0.35, darkness: 0, wind: 0.15, storm: 0,
    sun: 1, haze: 0, drawDistance: 1, wet: 0, shimmer: 0, exposure: 1, bleach: 0, fogWarm: 0,
  },
  heat: {
    rain: 0, dust: 0.1, cloud: 0.05, darkness: 0, wind: 0.1, storm: 0,
    sun: 1.25, haze: 0.1, drawDistance: 1, wet: 0, shimmer: 0.8, exposure: 1.08, bleach: 0.7, fogWarm: 0.4,
  },
  harmattan: {
    rain: 0, dust: 0.9, cloud: 0.05, darkness: 0.1, wind: 0.55, storm: 0,
    sun: 0.45, haze: 0.85, drawDistance: 0.45, wet: 0, shimmer: 0, exposure: 0.95, bleach: 0.2, fogWarm: 1,
  },
  rain: {
    rain: 0.85, dust: 0, cloud: 0.85, darkness: 0.45, wind: 0.35, storm: 0,
    sun: 0.4, haze: 0.1, drawDistance: 0.6, wet: 1, shimmer: 0, exposure: 0.9, bleach: 0, fogWarm: 0,
  },
  storm: {
    rain: 1, dust: 0.15, cloud: 1, darkness: 0.85, wind: 1, storm: 1,
    sun: 0.2, haze: 0.2, drawDistance: 0.45, wet: 1, shimmer: 0, exposure: 0.85, bleach: 0, fogWarm: 0,
  },
};

/** Neighbour graph. Transitions are only between states that can plausibly follow each other. */
export const WEATHER_GRAPH: Record<VisualWeatherId, readonly VisualWeatherId[]> = {
  clear: ["heat", "harmattan", "rain"],
  heat: ["clear", "harmattan"],
  harmattan: ["clear", "heat"],
  rain: ["clear", "storm"],
  storm: ["rain"],
};

/** Next state to move to on the way from `from` to `to` (breadth first). Returns `from` when already there. */
export function nextHop(from: VisualWeatherId, to: VisualWeatherId): VisualWeatherId {
  if (from === to) return from;
  const prev = new Map<VisualWeatherId, VisualWeatherId>();
  const queue: VisualWeatherId[] = [from];
  prev.set(from, from);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of WEATHER_GRAPH[cur]) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      if (n === to) {
        let step = to;
        while (prev.get(step) !== from) step = prev.get(step)!;
        return step;
      }
      queue.push(n);
    }
  }
  return from;
}

/** Map the seasonal weather (weatherStore) onto the visual state machine. */
export function visualFromSeasonal(weatherId: "dry" | "rainy" | "harmattan"): VisualWeatherId {
  if (weatherId === "rainy") return "rain";
  if (weatherId === "harmattan") return "harmattan";
  return "heat";
}

export const WEATHER_PARAM_KEYS = Object.keys(WEATHER_TARGETS.clear) as (keyof WeatherParams)[];

/** Copy target values into a blend object (used to jump instantly, for tests and the shot harness). */
export function setBlendTo(blend: WeatherParams, target: WeatherParams): void {
  for (const k of WEATHER_PARAM_KEYS) blend[k] = target[k];
}

/**
 * Ease the blend toward target by an exponential approach. Mutates `blend` in place (no allocation).
 * Returns true when every field is within `eps` of the target (the state is settled).
 * `rate` is per second: 1.1 reaches about 95 percent in roughly 2.5 seconds.
 */
export function stepBlend(blend: WeatherParams, target: WeatherParams, dt: number, rate = 1.1, eps = 0.005): boolean {
  const k = 1 - Math.exp(-Math.max(0, dt) * rate);
  let settled = true;
  for (const key of WEATHER_PARAM_KEYS) {
    const cur = blend[key];
    const want = target[key];
    let next = cur + (want - cur) * k;
    if (Math.abs(want - next) < eps) next = want;
    else settled = false;
    blend[key] = next;
  }
  return settled;
}

// ---------------------------------------------------------------------------
// Wind gusts: an event bus other systems subscribe to (the interior door and
// shutter mechanic is the first subscriber).
// ---------------------------------------------------------------------------

export interface WindGust {
  /** 0..1 gust strength. */
  strength: number;
  /** Seconds of world time the gust was raised at (monotonic within a session). */
  at: number;
}

type GustListener = (gust: WindGust) => void;
const gustListeners = new Set<GustListener>();
const gustEvent: WindGust = { strength: 0, at: 0 };
let worldTime = 0;

/** Subscribe to gust events. Returns the unsubscribe function. */
export function subscribeWindGust(listener: GustListener): () => void {
  gustListeners.add(listener);
  return () => {
    gustListeners.delete(listener);
  };
}

/** Advance the wind clock once per frame so gust timestamps are monotonic. */
export function advanceWindClock(dt: number): void {
  worldTime += Math.max(0, dt);
}

/** Raise a gust. The event object is reused, so listeners must copy values they keep. */
export function emitWindGust(strength: number): void {
  gustEvent.strength = Math.min(1, Math.max(0, strength));
  gustEvent.at = worldTime;
  gustListeners.forEach((l) => l(gustEvent));
}

export function windGustListenerCount(): number {
  return gustListeners.size;
}

export interface GustClock {
  /** Seconds until the next gust while a storm is building. */
  timer: number;
}

export function createGustClock(): GustClock {
  return { timer: 2 };
}

/**
 * Advance the gust clock. Returns a gust strength when one fires this step, else 0.
 * Gusts only come from storm strength. `roll` returns [0, 1); pass Math.random in the game.
 */
export function stepGustClock(clock: GustClock, storm: number, dt: number, roll: () => number): number {
  if (storm < 0.3) {
    clock.timer = 2 + roll() * 3;
    return 0;
  }
  clock.timer -= Math.max(0, dt);
  if (clock.timer > 0) return 0;
  clock.timer = 3 + roll() * 5;
  return storm * (0.5 + roll() * 0.5);
}

// ---------------------------------------------------------------------------
// Vegetation sway and gust ripple. Pure math, no three.js. Each plant takes the
// shared wind blend plus any recent gust, delayed by its distance from the gust origin
// so the ripple travels across the village instead of moving everything at once.
// ---------------------------------------------------------------------------

const RIPPLE_SPEED = 9; // metres per second the gust front travels
const RIPPLE_DECAY = 1.4; // how fast a gust fades after the front passes
let lastGust: WindGust = { strength: 0, at: -1e9 };
let gustSubscribed = false;

function ensureGustSubscription(): void {
  if (gustSubscribed) return;
  gustSubscribed = true;
  subscribeWindGust((g) => {
    lastGust = { strength: g.strength, at: g.at };
  });
}

/** Shared-wind sway for a plant at (x, z), in radians. Continuous while wind > 0. */
export function windSwayAt(x: number, z: number, wind: number, timeSec: number): number {
  ensureGustSubscription();
  const phase = x * 0.37 + z * 0.23;
  const base = Math.sin(timeSec * (0.8 + wind * 1.6) + phase) * (0.02 + wind * 0.12);
  // Gust ripple: the front reaches a plant after dist / RIPPLE_SPEED seconds (gust origin at the village centre).
  const dist = Math.sqrt(x * x + z * z);
  const arrive = lastGust.at + dist / RIPPLE_SPEED;
  const age = worldTime - arrive;
  const gust = age >= 0 ? lastGust.strength * Math.exp(-age * RIPPLE_DECAY) * Math.sin(age * 6) : 0;
  return base + gust * 0.25;
}
