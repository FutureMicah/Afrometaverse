import { create } from "zustand";
import { useWeatherStore, WeatherId, TimeOfDay } from "./weatherStore";

export type DisasterId = "flood" | "dust_storm" | "none";
export type DistrictCondition = "normal" | "flooded" | "blocked" | "at_risk" | "hazardous";

export interface District {
  id: string;
  name: string;
  condition: DistrictCondition;
  accessibility: number; // 0-100, 100 = fully accessible
  riskLevel: number; // 0-100, 0 = safe
  crowdLevel: number; // 0-100, how many people are active
  warnings: string[];
  floodDepth: number; // meters, 0 if not flooded
  visibility: number; // 0-100, affected by dust/rain
  safetyTip: string;
}

export interface WorldState {
  day: number;
  weatherId: WeatherId;
  timeOfDay: TimeOfDay;
  currentDisaster: DisasterId;
  disasterIntensity: number; // 0-100
  disasterDuration: number; // days remaining
  districts: Record<string, District>;
  cityMood: "calm" | "cautious" | "anxious" | "emergency";
  globalEvents: string[];
  lastUpdateDay: number;
}

const INITIAL_DISTRICTS = {
  "town-market": {
    id: "town-market",
    name: "Town Market",
    condition: "normal" as DistrictCondition,
    accessibility: 100,
    riskLevel: 0,
    crowdLevel: 85,
    warnings: [],
    floodDepth: 0,
    visibility: 100,
    safetyTip: "Miles One market road is bustling today.",
  },
  "civic-centre": {
    id: "civic-centre",
    name: "Civic Centre",
    condition: "normal" as DistrictCondition,
    accessibility: 100,
    riskLevel: 0,
    crowdLevel: 40,
    warnings: [],
    floodDepth: 0,
    visibility: 100,
    safetyTip: "The assembly hall is open for community business.",
  },
  creekside: {
    id: "creekside",
    name: "Creekside",
    condition: "normal" as DistrictCondition,
    accessibility: 100,
    riskLevel: 15, // naturally high risk due to water
    crowdLevel: 60,
    warnings: [],
    floodDepth: 0,
    visibility: 100,
    safetyTip: "The ferry crossings are running smoothly.",
  },
  port: {
    id: "port",
    name: "The Port",
    condition: "normal" as DistrictCondition,
    accessibility: 100,
    riskLevel: 0,
    crowdLevel: 50,
    warnings: [],
    floodDepth: 0,
    visibility: 100,
    safetyTip: "Container operations continue normally.",
  },
};

export const useWorldStateStore = create<{
  state: WorldState;
  updateWorldState: (day: number) => void;
  triggerFlood: (intensity: number, duration: number) => void;
  triggerDustStorm: (intensity: number, duration: number) => void;
  clearDisaster: () => void;
  getDistrictSafetyMultiplier: (districtId: string) => number;
  getJobAvailability: (districtId: string) => number;
}>((set, get) => {
  const updateWorldState = (day: number) => {
    const weatherStore = useWeatherStore.getState();
    const currentState = get().state;

    // Determine if a disaster should start
    let newDisaster = currentState.currentDisaster;
    let newIntensity = Math.max(0, currentState.disasterIntensity - 5); // Fade out disasters
    let newDuration = Math.max(0, currentState.disasterDuration - 1);

    // Rainy season (days 61-150) has flood risk
    const normalizedDay = ((day - 1) % 365) + 1;
    if (normalizedDay > 61 && normalizedDay < 150) {
      // 30% chance of flood event during rainy season
      if (Math.random() < 0.3 && newDisaster === "none") {
        newDisaster = "flood";
        newIntensity = 40 + Math.random() * 40; // 40-80% intensity
        newDuration = 3 + Math.floor(Math.random() * 4); // 3-7 days
      }
    }

    // Harmattan season (days 151-250) has dust storm risk
    if (normalizedDay > 151 && normalizedDay < 250) {
      if (Math.random() < 0.2 && newDisaster === "none") {
        newDisaster = "dust_storm";
        newIntensity = 30 + Math.random() * 40; // 30-70% intensity
        newDuration = 2 + Math.floor(Math.random() * 3); // 2-5 days
      }
    }

    // Update districts based on disaster
    const updatedDistricts = { ...INITIAL_DISTRICTS };

    if (newDisaster === "flood") {
      // Creekside and low-lying areas affected
      updatedDistricts.creekside.condition = "flooded";
      updatedDistricts.creekside.floodDepth = (newIntensity / 100) * 1.5; // up to 1.5m
      updatedDistricts.creekside.accessibility = Math.max(10, 100 - newIntensity * 1.2);
      updatedDistricts.creekside.riskLevel = Math.min(100, 40 + newIntensity);
      updatedDistricts.creekside.crowdLevel = Math.max(10, 60 - newIntensity * 0.5);
      updatedDistricts.creekside.warnings = ["⚠️ FLOOD WARNING", "Water levels rising", "Ferry service limited"];
      updatedDistricts.creekside.safetyTip = `Water depth: ${updatedDistricts.creekside.floodDepth.toFixed(1)}m. Avoid the jetty.`;

      // Town Market affected moderately
      updatedDistricts["town-market"].condition = "at_risk";
      updatedDistricts["town-market"].floodDepth = (newIntensity / 100) * 0.6;
      updatedDistricts["town-market"].accessibility = Math.max(50, 100 - newIntensity * 0.6);
      updatedDistricts["town-market"].riskLevel = Math.min(80, 20 + newIntensity * 0.5);
      updatedDistricts["town-market"].crowdLevel = Math.max(30, 85 - newIntensity * 0.4);
      updatedDistricts["town-market"].warnings = ["⚠️ FLOOD WATCH", "Slick surfaces", "Stalls closing early"];
      updatedDistricts["town-market"].safetyTip = "Streets are slick. Market vendors are relocating goods.";

      // Port slightly affected
      updatedDistricts.port.condition = "at_risk";
      updatedDistricts.port.accessibility = Math.max(70, 100 - newIntensity * 0.3);
      updatedDistricts.port.riskLevel = newIntensity * 0.3;
      updatedDistricts.port.crowdLevel = Math.max(40, 50 - newIntensity * 0.2);
      updatedDistricts.port.warnings = ["⚠️ OPERATIONS ALERT", "Crane work limited"];
      updatedDistricts.port.safetyTip = "Port operations are at reduced capacity.";
    }

    if (newDisaster === "dust_storm") {
      // Harmattan dust affects all districts, especially port and civic centre
      updatedDistricts.port.condition = "hazardous";
      updatedDistricts.port.visibility = Math.max(30, 100 - newIntensity);
      updatedDistricts.port.riskLevel = Math.min(70, newIntensity * 0.5);
      updatedDistricts.port.accessibility = Math.max(40, 100 - newIntensity * 0.5);
      updatedDistricts.port.crowdLevel = Math.max(20, 50 - newIntensity * 0.3);
      updatedDistricts.port.warnings = ["⚠️ DUST STORM", "Visibility low", "Masks recommended"];
      updatedDistricts.port.safetyTip = `Visibility: ${updatedDistricts.port.visibility.toFixed(0)}m. Stay indoors if possible.`;

      // Civic centre visibility reduced
      updatedDistricts["civic-centre"].visibility = Math.max(40, 100 - newIntensity * 0.7);
      updatedDistricts["civic-centre"].condition = "at_risk";
      updatedDistricts["civic-centre"].riskLevel = newIntensity * 0.3;
      updatedDistricts["civic-centre"].crowdLevel = Math.max(20, 40 - newIntensity * 0.2);
      updatedDistricts["civic-centre"].warnings = ["⚠️ DUST WATCH", "Air quality poor"];
      updatedDistricts["civic-centre"].safetyTip = "Air is thick with dust. Protect your respiratory system.";

      // Market affected by dust
      updatedDistricts["town-market"].visibility = Math.max(50, 100 - newIntensity * 0.6);
      updatedDistricts["town-market"].condition = "at_risk";
      updatedDistricts["town-market"].riskLevel = newIntensity * 0.2;
      updatedDistricts["town-market"].crowdLevel = Math.max(40, 85 - newIntensity * 0.3);
      updatedDistricts["town-market"].warnings = ["🌫️ DUST ALERT", "Goods covered", "Ventilation issues"];
      updatedDistricts["town-market"].safetyTip = "Vendors have covered their goods. Business moves slower.";
    }

    // Determine city mood based on disaster
    let cityMood: "calm" | "cautious" | "anxious" | "emergency" = "calm";
    if (newDisaster !== "none") {
      if (newIntensity > 70) cityMood = "emergency";
      else if (newIntensity > 50) cityMood = "anxious";
      else cityMood = "cautious";
    }

    // Generate global events
    const events: string[] = [];
    if (newDisaster === "flood") {
      if (newIntensity > 60) events.push("🚨 EMERGENCY: Major flooding in Creekside. Stay home if possible.");
      else events.push("⚠️ Flooding reported. Ferry services interrupted.");
    }
    if (newDisaster === "dust_storm") {
      if (newIntensity > 60)
        events.push("🚨 EMERGENCY: Severe dust storm sweeping the city. Visibility near zero.");
      else events.push("⚠️ Dust storm active. Air quality declining.");
    }
    if (newDisaster === "none" && currentState.currentDisaster !== "none") {
      events.push("✅ Disaster conditions clearing. City returning to normal.");
    }

    set({
      state: {
        day,
        weatherId: weatherStore.state.weatherId,
        timeOfDay: weatherStore.state.timeOfDay,
        currentDisaster: newDisaster,
        disasterIntensity: newIntensity,
        disasterDuration: newDuration,
        districts: updatedDistricts,
        cityMood,
        globalEvents: events,
        lastUpdateDay: day,
      },
    });
  };

  const triggerFlood = (intensity: number, duration: number) => {
    const state = get().state;
    set({
      state: {
        ...state,
        currentDisaster: "flood",
        disasterIntensity: intensity,
        disasterDuration: duration,
      },
    });
    updateWorldState(state.day);
  };

  const triggerDustStorm = (intensity: number, duration: number) => {
    const state = get().state;
    set({
      state: {
        ...state,
        currentDisaster: "dust_storm",
        disasterIntensity: intensity,
        disasterDuration: duration,
      },
    });
    updateWorldState(state.day);
  };

  const clearDisaster = () => {
    const state = get().state;
    set({
      state: {
        ...state,
        currentDisaster: "none",
        disasterIntensity: 0,
        disasterDuration: 0,
      },
    });
    updateWorldState(state.day);
  };

  const getDistrictSafetyMultiplier = (districtId: string) => {
    const district = get().state.districts[districtId];
    if (!district) return 1;
    // 0% accessibility = 0x multiplier (no jobs), 100% = 1x multiplier
    return district.accessibility / 100;
  };

  const getJobAvailability = (districtId: string) => {
    const district = get().state.districts[districtId];
    if (!district) return 1;
    // Jobs scale with accessibility and are reduced by risk
    const availabilityFromAccess = district.accessibility / 100;
    const riskPenalty = 1 - district.riskLevel / 200; // risk reduces by up to 50%
    return Math.max(0, availabilityFromAccess * riskPenalty);
  };

  return {
    state: {
      day: 1,
      weatherId: "dry",
      timeOfDay: "morning",
      currentDisaster: "none",
      disasterIntensity: 0,
      disasterDuration: 0,
      districts: INITIAL_DISTRICTS,
      cityMood: "calm",
      globalEvents: [],
      lastUpdateDay: 1,
    },
    updateWorldState,
    triggerFlood,
    triggerDustStorm,
    clearDisaster,
    getDistrictSafetyMultiplier,
    getJobAvailability,
  };
});
