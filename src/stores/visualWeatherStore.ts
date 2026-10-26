import { create } from "zustand";
import {
  WEATHER_TARGETS,
  type VisualWeatherId,
  type WeatherParams,
  nextHop,
  setBlendTo,
  stepBlend,
  visualFromSeasonal,
} from "@/lib/weatherSystem";
import { useWeatherStore } from "@/stores/weatherStore";

/**
 * Live visual weather. One store, read every frame by the scene layers through getState()
 * (no React re-render per frame). `current` is the state the player sees, `target` is the
 * state being walked toward. `blend` is the eased numbers the layers read.
 */
interface VisualWeatherStore {
  current: VisualWeatherId;
  target: VisualWeatherId;
  /** Eased parameters. Mutated in place every frame by the weather driver. */
  blend: WeatherParams;
  /** Debug override from the switcher. When set, the seasonal weather is ignored. */
  override: VisualWeatherId | null;
  /** Lightning flash strength 0..1 (storm only), decays fast. */
  flash: number;
  setTarget: (id: VisualWeatherId) => void;
  setOverride: (id: VisualWeatherId | null) => void;
  /** Advance the state machine one frame. Returns the active state id. */
  tick: (dt: number, seasonal: VisualWeatherId) => VisualWeatherId;
}

export const useVisualWeatherStore = create<VisualWeatherStore>((set, get) => {
  const blend = { ...WEATHER_TARGETS.clear };
  return {
    current: "clear",
    target: "clear",
    blend,
    override: null,
    flash: 0,
    setTarget: (id) => set({ target: id }),
    setOverride: (id) => {
      set({ override: id });
      if (id) set({ target: id });
    },
    tick: (dt, seasonal) => {
      const s = get();
      const want = s.override ?? seasonal;
      if (want !== s.target) set({ target: want });
      const goal = get().target;
      // Walk the graph one hop at a time. The hop becomes the current state once it settles.
      const hop = nextHop(s.current, goal);
      const settled = stepBlend(blend, WEATHER_TARGETS[hop], dt);
      if (settled && hop !== s.current) set({ current: hop });
      return get().current;
    },
  };
});

/** Re-export so callers can jump instantly (tests and the shot harness). */
export function jumpVisualWeather(id: VisualWeatherId): void {
  const st = useVisualWeatherStore.getState();
  setBlendTo(st.blend, WEATHER_TARGETS[id]);
  useVisualWeatherStore.setState({ current: id, target: id, override: null });
}

/** Seasonal default for the current day (what the weatherStore says). */
export function seasonalVisualWeather(): VisualWeatherId {
  const id = useWeatherStore.getState().state.weatherId;
  return visualFromSeasonal(id);
}

