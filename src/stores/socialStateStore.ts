import { create } from "zustand";

import { useEconomyStore } from "./economyStore";
import { useResilienceStore } from "./resilienceStore";
import { useWeatherStore } from "./weatherStore";
import { useWorldStateStore } from "./worldStateStore";

export type SocialMood = "calm" | "uneasy" | "anxious" | "emergency" | "recovering";

export interface DistrictSocialState {
  districtId: "town-market" | "civic-centre" | "creekside" | "port";
  mood: SocialMood;
  activityLevel: number;
  fearIndex: number;
  trustIndex: number;
  headline: string;
}

export interface SocialState {
  cityMood: SocialMood;
  activeCitizens: number;
  districtStates: Record<string, DistrictSocialState>;
  feed: string[];
  lastUpdatedDay: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const INITIAL_DISTRICTS = {
  "town-market": {
    districtId: "town-market",
    mood: "calm",
    activityLevel: 82,
    fearIndex: 18,
    trustIndex: 76,
    headline: "Market buzz is steady and sellers are optimistic.",
  },
  "civic-centre": {
    districtId: "civic-centre",
    mood: "calm",
    activityLevel: 64,
    fearIndex: 20,
    trustIndex: 80,
    headline: "Civic leaders are meeting and residents are listening.",
  },
  creekside: {
    districtId: "creekside",
    mood: "calm",
    activityLevel: 58,
    fearIndex: 24,
    trustIndex: 70,
    headline: "Creekside remains active as ferries and traders keep moving.",
  },
  port: {
    districtId: "port",
    mood: "calm",
    activityLevel: 68,
    fearIndex: 22,
    trustIndex: 74,
    headline: "Port operations remain active and organized.",
  },
} as const;

export const useSocialStateStore = create<{
  state: SocialState;
  syncSocialState: () => void;
  getDistrictMood: (districtId: string) => DistrictSocialState | undefined;
}>((set, get) => {
  const buildDistrictStates = (): Record<string, DistrictSocialState> => {
    const world = useWorldStateStore.getState().state;
    const weather = useWeatherStore.getState().state;
    const resilience = useResilienceStore.getState();
    const economy = useEconomyStore.getState().state;

    const nextDistricts: Record<string, DistrictSocialState> = {};

    for (const [districtId, base] of Object.entries(INITIAL_DISTRICTS)) {
      const worldDistrict = world.districts[districtId];
      const districtEconomy = economy[districtId as keyof typeof economy];
      const resilienceValue = resilience.getMitigationFor(districtId, world.currentDisaster === "flood" ? "flood" : "dust_storm");

      const fearBase = worldDistrict.riskLevel;
      const weatherStress =
        weather.weatherId === "rainy" ? 15 : weather.weatherId === "harmattan" ? 18 : 6;
      const stress = clamp(fearBase + weatherStress - resilienceValue * 0.25, 0, 100);
      const activity = clamp(
        base.activityLevel - stress * 0.45 + districtEconomy.tradeFlow * 0.2 + resilience.cityResilience * 0.12,
        0,
        100,
      );
      const trust = clamp(base.trustIndex + resilience.cityResilience * 0.15 - stress * 0.14, 0, 100);

      let mood: SocialMood = "calm";
      if (world.currentDisaster === "flood" && stress > 70) mood = "emergency";
      else if (world.currentDisaster === "dust_storm" && stress > 65) mood = "anxious";
      else if (stress > 48) mood = "uneasy";
      else if (stress > 28) mood = "anxious";
      else if (world.currentDisaster === "none" && resilience.cityResilience > 68) mood = "recovering";

      let headline = `${base.headline}`;
      if (world.currentDisaster === "flood") {
        headline = `Flood warnings are changing life across ${base.districtId === "creekside" ? "Creekside" : base.districtId === "town-market" ? "Town Market" : base.districtId === "port" ? "The Port" : "the Civic Centre"}.`;
      }
      if (world.currentDisaster === "dust_storm") {
        headline = `Dust is reducing visibility and making movement slower in ${base.districtId === "town-market" ? "Town Market" : base.districtId === "port" ? "The Port" : "the city"}.`;
      }
      if (world.currentDisaster === "none" && resilience.cityResilience > 65) {
        headline = `Citizens are regaining confidence as the city recovers and stabilizes.`;
      }

      nextDistricts[districtId] = {
        districtId: base.districtId,
        mood,
        activityLevel: Math.round(activity),
        fearIndex: Math.round(stress),
        trustIndex: Math.round(trust),
        headline,
      };
    }

    return nextDistricts;
  };

  const buildFeed = (): string[] => {
    const world = useWorldStateStore.getState().state;
    const weather = useWeatherStore.getState().state;
    const resilience = useResilienceStore.getState();

    const feed: string[] = [];

    if (world.currentDisaster === "flood") {
      feed.push("Flooding has pushed traders to close earlier and residents to move their goods to higher ground.");
      feed.push("Creekside residents are warning that ferry access may be disrupted until the waters recede.");
    }

    if (world.currentDisaster === "dust_storm") {
      feed.push("Dust storms are reducing visibility along the roads and slowing cargo movement in the port.");
      feed.push("Residents are advising one another to stay indoors and cover exposed goods.");
    }

    if (world.currentDisaster === "none") {
      feed.push("The city feels calmer today as people return to trade and public routines.");
    }

    if (weather.weatherId === "rainy") {
      feed.push("Rainy season chatter is focused on drainage, roads, and whether the city is ready for another storm cycle.");
    }

    if (weather.weatherId === "harmattan") {
      feed.push("The Harmattan is making the city feel drier, dustier, and more cautious.");
    }

    if (resilience.cityResilience > 70) {
      feed.push("Civic investment is visibly improving confidence across the city.");
    }

    return feed.slice(0, 5);
  };

  const initialDistrictStates = buildDistrictStates();
  const cityMoodValue = (world: any) => {
    const disaster = world.currentDisaster;
    if (disaster === "flood") return "emergency";
    if (disaster === "dust_storm") return "anxious";
    if (world.cityMood === "cautious") return "uneasy";
    if (world.cityMood === "calm") return "calm";
    return "recovering";
  };

  const initialWorld = useWorldStateStore.getState().state;

  return {
    state: {
      cityMood: cityMoodValue(initialWorld),
      activeCitizens: 72,
      districtStates: initialDistrictStates,
      feed: buildFeed(),
      lastUpdatedDay: initialWorld.day,
    },
    syncSocialState: () => {
      const world = useWorldStateStore.getState().state;
      const districtStates = buildDistrictStates();
      const nextCityMood = cityMoodValue(world);
      const activeCitizens = clamp(
        58 + world.disasterIntensity * 0.18 + useResilienceStore.getState().cityResilience * 0.22,
        20,
        100,
      );

      set({
        state: {
          cityMood: nextCityMood,
          activeCitizens: Math.round(activeCitizens),
          districtStates,
          feed: buildFeed(),
          lastUpdatedDay: world.day,
        },
      });
    },
    getDistrictMood: (districtId) => get().state.districtStates[districtId],
  };
});
