import { create } from "zustand";

import { useResilienceStore } from "./resilienceStore";
import { useWeatherStore } from "./weatherStore";
import { useWorldStateStore } from "./worldStateStore";

export type DistrictEconomicId = "town-market" | "civic-centre" | "creekside" | "port";

export interface DistrictEconomyState {
  districtId: DistrictEconomicId;
  tradeFlow: number; // 0-100
  jobAvailability: number; // 0-100
  jobMultiplier: number; // 1.0 base, scales payout
  priceMultiplier: number; // 1.0 base, scales market prices
  recoverySpeed: number; // 0-100
  riskPenalty: number; // 0-100
  status: "stable" | "strained" | "disrupted" | "critical";
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const BASE_DISTRICT_ECONOMY: Record<DistrictEconomicId, DistrictEconomyState> = {
  "town-market": {
    districtId: "town-market",
    tradeFlow: 82,
    jobAvailability: 80,
    jobMultiplier: 1,
    priceMultiplier: 1,
    recoverySpeed: 72,
    riskPenalty: 12,
    status: "stable",
  },
  "civic-centre": {
    districtId: "civic-centre",
    tradeFlow: 64,
    jobAvailability: 66,
    jobMultiplier: 1,
    priceMultiplier: 1,
    recoverySpeed: 74,
    riskPenalty: 10,
    status: "stable",
  },
  creekside: {
    districtId: "creekside",
    tradeFlow: 58,
    jobAvailability: 52,
    jobMultiplier: 1.15,
    priceMultiplier: 1.1,
    recoverySpeed: 48,
    riskPenalty: 20,
    status: "stable",
  },
  port: {
    districtId: "port",
    tradeFlow: 70,
    jobAvailability: 72,
    jobMultiplier: 1.2,
    priceMultiplier: 1.15,
    recoverySpeed: 62,
    riskPenalty: 15,
    status: "stable",
  },
};

export const useEconomyStore = create<{
  state: Record<DistrictEconomicId, DistrictEconomyState>;
  syncEconomy: () => void;
  getDistrictEconomy: (districtId: DistrictEconomicId) => DistrictEconomyState | undefined;
  getJobMultiplier: (districtId: DistrictEconomicId) => number;
  getPriceMultiplier: (districtId: DistrictEconomicId) => number;
  getTradeFlow: (districtId: DistrictEconomicId) => number;
  getRecoverySpeed: (districtId: DistrictEconomicId) => number;
}>((set, get) => {
  const calculateDistrictEconomy = (): Record<DistrictEconomicId, DistrictEconomyState> => {
    const world = useWorldStateStore.getState().state;
    const weather = useWeatherStore.getState().state;
    const resilience = useResilienceStore.getState();

    const next: Record<DistrictEconomicId, DistrictEconomyState> = { ...BASE_DISTRICT_ECONOMY };

    for (const districtId of Object.keys(BASE_DISTRICT_ECONOMY) as DistrictEconomicId[]) {
      const districtWorldState = world.districts[districtId];
      const resilienceMitigation =
        world.currentDisaster === "flood"
          ? resilience.getMitigationFor(districtId, "flood")
          : world.currentDisaster === "dust_storm"
            ? resilience.getMitigationFor(districtId, "dust_storm")
            : 0;

      const base = BASE_DISTRICT_ECONOMY[districtId];
      const accessPenalty = 100 - districtWorldState.accessibility;
      const riskPenalty = districtWorldState.riskLevel;
      const weatherPenalty =
        weather.weatherId === "rainy"
          ? 10
          : weather.weatherId === "harmattan"
            ? 14
            : weather.weatherId === "dry"
              ? 4
              : 0;

      const resilienceDiscount = resilienceMitigation * 0.25;
      const reducedRisk = Math.max(0, riskPenalty - resilienceDiscount - weatherPenalty);
      const accessibilityBoost = Math.max(0, districtWorldState.accessibility - accessPenalty * 0.1);

      const tradeFlow = clamp(
        base.tradeFlow - reducedRisk * 0.5 - accessPenalty * 0.35 + accessibilityBoost * 0.35 + resilience.getRecoveryBoost(districtId) * 0.2,
        0,
        100,
      );

      const jobAvailability = clamp(
        base.jobAvailability - reducedRisk * 0.45 - accessPenalty * 0.3 + resilience.getMitigationFor(districtId, world.currentDisaster === "flood" ? "flood" : "dust_storm") * 0.15,
        0,
        100,
      );

      const jobMultiplier = clamp(
        base.jobMultiplier + (world.currentDisaster === "none" ? 0 : 0.20) + resilience.getRecoveryBoost(districtId) / 210,
        0.65,
        1.9,
      );

      const priceMultiplier = clamp(
        base.priceMultiplier + (world.currentDisaster === "none" ? 0 : 0.18) + (weather.weatherId === "rainy" ? 0.16 : 0) + (weather.weatherId === "harmattan" ? 0.12 : 0),
        0.75,
        2.2,
      );

      const recoverySpeed = clamp(
        base.recoverySpeed + resilience.getRecoveryBoost(districtId) * 0.4 - reducedRisk * 0.2,
        10,
        100,
      );

      const riskPenaltyValue = clamp(reducedRisk + accessPenalty * 0.5, 0, 100);

      let status: DistrictEconomyState["status"] = "stable";
      if (riskPenaltyValue > 70) status = "critical";
      else if (riskPenaltyValue > 45) status = "disrupted";
      else if (riskPenaltyValue > 20) status = "strained";

      next[districtId] = {
        districtId,
        tradeFlow: Math.round(tradeFlow),
        jobAvailability: Math.round(jobAvailability),
        jobMultiplier: Number(jobMultiplier.toFixed(2)),
        priceMultiplier: Number(priceMultiplier.toFixed(2)),
        recoverySpeed: Math.round(recoverySpeed),
        riskPenalty: Math.round(riskPenaltyValue),
        status,
      };
    }

    return next;
  };

  return {
    state: calculateDistrictEconomy(),
    syncEconomy: () => {
      const next = calculateDistrictEconomy();
      set({ state: next });
    },
    getDistrictEconomy: (districtId) => get().state[districtId],
    getJobMultiplier: (districtId) => get().state[districtId]?.jobMultiplier ?? 1,
    getPriceMultiplier: (districtId) => get().state[districtId]?.priceMultiplier ?? 1,
    getTradeFlow: (districtId) => get().state[districtId]?.tradeFlow ?? 0,
    getRecoverySpeed: (districtId) => get().state[districtId]?.recoverySpeed ?? 0,
  };
});
