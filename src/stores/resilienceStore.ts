import { create } from "zustand";

export type InfrastructureKey =
  | "drainage"
  | "floodwalls"
  | "shelters"
  | "roadworks"
  | "dust_control"
  | "ferry_support";

export type DisasterType = "flood" | "dust_storm";

export interface DistrictInfrastructure {
  drainage: number;
  floodwalls: number;
  shelters: number;
  roadworks: number;
  dust_control: number;
  ferry_support: number;
}

export interface DistrictResilience {
  id: string;
  name: string;
  total: number;
  floodMitigation: number;
  dustMitigation: number;
  recoveryBoost: number;
  infrastructure: DistrictInfrastructure;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const INITIAL_DISTRICT_INFRASTRUCTURE: Record<string, DistrictInfrastructure> = {
  "town-market": {
    drainage: 25,
    floodwalls: 15,
    shelters: 20,
    roadworks: 35,
    dust_control: 18,
    ferry_support: 10,
  },
  "civic-centre": {
    drainage: 30,
    floodwalls: 20,
    shelters: 55,
    roadworks: 40,
    dust_control: 22,
    ferry_support: 15,
  },
  creekside: {
    drainage: 15,
    floodwalls: 10,
    shelters: 25,
    roadworks: 18,
    dust_control: 12,
    ferry_support: 50,
  },
  port: {
    drainage: 35,
    floodwalls: 30,
    shelters: 28,
    roadworks: 45,
    dust_control: 25,
    ferry_support: 30,
  },
};

const getDistrictMitigation = (infrastructure: DistrictInfrastructure) => {
  const floodMitigation =
    infrastructure.drainage * 0.35 +
    infrastructure.floodwalls * 0.25 +
    infrastructure.roadworks * 0.2 +
    infrastructure.shelters * 0.12 +
    infrastructure.ferry_support * 0.08;

  const dustMitigation =
    infrastructure.roadworks * 0.2 +
    infrastructure.shelters * 0.2 +
    infrastructure.dust_control * 0.35 +
    infrastructure.ferry_support * 0.1 +
    infrastructure.drainage * 0.15;

  return {
    floodMitigation: clamp(floodMitigation, 0, 100),
    dustMitigation: clamp(dustMitigation, 0, 100),
  };
};

const getDistrictTotal = (infrastructure: DistrictInfrastructure) => {
  const values = Object.values(infrastructure);
  const total = values.reduce((sum, value) => sum + value, 0);
  return clamp(total / values.length, 0, 100);
};

export const useResilienceStore = create<{
  cityResilience: number;
  districtResilience: Record<string, DistrictResilience>;
  infrastructure: Record<string, DistrictInfrastructure>;
  applyInfrastructureUpgrade: (districtId: string, key: InfrastructureKey, amount: number) => void;
  applyProposalImpact: (districtId: string, impact: Partial<DistrictInfrastructure>) => void;
  recalculate: () => void;
  getMitigationFor: (districtId: string, disasterType: DisasterType) => number;
  getRecoveryBoost: (districtId: string) => number;
}>((set, get) => {
  const computeDistrictMap = (infrastructure: Record<string, DistrictInfrastructure>) => {
    const districtResilience: Record<string, DistrictResilience> = {};

    for (const [districtId, districtData] of Object.entries(infrastructure)) {
      const nameMap: Record<string, string> = {
        "town-market": "Town Market",
        "civic-centre": "Civic Centre",
        creekside: "Creekside",
        port: "The Port",
      };

      const mitigation = getDistrictMitigation(districtData);

      districtResilience[districtId] = {
        id: districtId,
        name: nameMap[districtId] ?? districtId,
        total: getDistrictTotal(districtData),
        floodMitigation: mitigation.floodMitigation,
        dustMitigation: mitigation.dustMitigation,
        recoveryBoost: clamp((mitigation.floodMitigation + mitigation.dustMitigation) / 2, 0, 100),
        infrastructure: districtData,
      };
    }

    return districtResilience;
  };

  const initialInfrastructure = INITIAL_DISTRICT_INFRASTRUCTURE;
  const initialDistrictResilience = computeDistrictMap(initialInfrastructure);
  const initialCityResilience =
    Object.values(initialDistrictResilience).reduce((sum, district) => sum + district.total, 0) /
    Math.max(Object.keys(initialDistrictResilience).length, 1);

  return {
    cityResilience: initialCityResilience,
    districtResilience: initialDistrictResilience,
    infrastructure: initialInfrastructure,
    applyInfrastructureUpgrade: (districtId, key, amount) => {
      const district = get().infrastructure[districtId];
      if (!district) return;

      const nextDistrict = {
        ...district,
        [key]: clamp(district[key] + amount, 0, 100),
      };

      const nextInfrastructure = {
        ...get().infrastructure,
        [districtId]: nextDistrict,
      };

      const nextDistrictResilience = computeDistrictMap(nextInfrastructure);
      const nextCityResilience =
        Object.values(nextDistrictResilience).reduce((sum, district) => sum + district.total, 0) /
        Math.max(Object.keys(nextDistrictResilience).length, 1);

      set({
        infrastructure: nextInfrastructure,
        districtResilience: nextDistrictResilience,
        cityResilience: nextCityResilience,
      });
    },
    applyProposalImpact: (districtId, impact) => {
      const district = get().infrastructure[districtId];
      if (!district) return;

      const nextInfrastructure = {
        ...district,
        ...Object.fromEntries(
          Object.entries(impact).map(([key, value]) => {
            const typedKey = key as InfrastructureKey;
            return [typedKey, clamp((district[typedKey] ?? 0) + (value ?? 0), 0, 100)];
          }),
        ),
      };

      const nextMap = {
        ...get().infrastructure,
        [districtId]: nextInfrastructure,
      };

      const recomputed = computeDistrictMap(nextMap);
      const nextCityResilience =
        Object.values(recomputed).reduce((sum, district) => sum + district.total, 0) /
        Math.max(Object.keys(recomputed).length, 1);

      set({
        infrastructure: nextMap,
        districtResilience: recomputed,
        cityResilience: nextCityResilience,
      });
    },
    recalculate: () => {
      const nextDistrictResilience = computeDistrictMap(get().infrastructure);
      const nextCityResilience =
        Object.values(nextDistrictResilience).reduce((sum, district) => sum + district.total, 0) /
        Math.max(Object.keys(nextDistrictResilience).length, 1);

      set({
        districtResilience: nextDistrictResilience,
        cityResilience: nextCityResilience,
      });
    },
    getMitigationFor: (districtId, disasterType) => {
      const district = get().districtResilience[districtId];
      if (!district) return 0;

      if (disasterType === "flood") return district.floodMitigation;
      return district.dustMitigation;
    },
    getRecoveryBoost: (districtId) => {
      const district = get().districtResilience[districtId];
      return district?.recoveryBoost ?? 0;
    },
  };
});
