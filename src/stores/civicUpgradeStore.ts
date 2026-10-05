import { create } from "zustand";

import { useResilienceStore } from "./resilienceStore";

export type ProposalId =
  | "drainage-revival-creekside"
  | "market-dust-shelters"
  | "port-safety-upgrade"
  | "ferry-support-initiative"
  | "civic-lighting-program"
  | "early-warning-network";

export interface CivicProposalEffect {
  drainage?: number;
  floodwalls?: number;
  shelters?: number;
  roadworks?: number;
  dust_control?: number;
  ferry_support?: number;
}

export interface CivicProposal {
  id: ProposalId;
  title: string;
  description: string;
  districtId: "town-market" | "civic-centre" | "creekside" | "port";
  category: "infrastructure" | "emergency" | "mobility" | "public-safety";
  requiredReputation: number;
  requiredSeason?: "any" | "rainy" | "dry" | "harmattan";
  effect: CivicProposalEffect;
}

export const CIVIC_PROPOSALS: CivicProposal[] = [
  {
    id: "drainage-revival-creekside",
    title: "Drainage Revival for Creekside",
    description: "Clear clogged channels and reinforce drainage before the rainy season turns the creekside into a flood zone.",
    districtId: "creekside",
    category: "infrastructure",
    requiredReputation: 8,
    requiredSeason: "rainy",
    effect: {
      drainage: 18,
      roadworks: 10,
      floodwalls: 12,
    },
  },
  {
    id: "market-dust-shelters",
    title: "Market Dust Shelters",
    description: "Build covered stalls and dust-resistant shelters so the Town Market can keep trading during Harmattan.",
    districtId: "town-market",
    category: "public-safety",
    requiredReputation: 12,
    requiredSeason: "harmattan",
    effect: {
      shelters: 18,
      dust_control: 20,
      roadworks: 8,
    },
  },
  {
    id: "port-safety-upgrade",
    title: "Port Safety Upgrade",
    description: "Strengthen the Port’s drainage and road access so cargo movement remains active even during storms.",
    districtId: "port",
    category: "infrastructure",
    requiredReputation: 15,
    requiredSeason: "rainy",
    effect: {
      drainage: 16,
      floodwalls: 14,
      roadworks: 18,
    },
  },
  {
    id: "ferry-support-initiative",
    title: "Ferry Support Initiative",
    description: "Improve creekside mobility and emergency rescue routes so ferries can continue moving people through flood periods.",
    districtId: "creekside",
    category: "mobility",
    requiredReputation: 10,
    requiredSeason: "rainy",
    effect: {
      ferry_support: 22,
      roadworks: 10,
      shelters: 8,
    },
  },
  {
    id: "civic-lighting-program",
    title: "Civic Lighting Program",
    description: "Install street lighting and protective barriers to make public routes safer after dark and during dust events.",
    districtId: "civic-centre",
    category: "public-safety",
    requiredReputation: 14,
    requiredSeason: "dry",
    effect: {
      shelters: 12,
      roadworks: 14,
      dust_control: 10,
    },
  },
  {
    id: "early-warning-network",
    title: "Early Warning Network",
    description: "Create a district alert system, sirens, and local reporting to reduce panic and speed recovery during storms.",
    districtId: "civic-centre",
    category: "emergency",
    requiredReputation: 18,
    requiredSeason: "any",
    effect: {
      shelters: 15,
      drainage: 8,
      dust_control: 12,
      ferry_support: 8,
    },
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const useCivicUpgradeStore = create<{
  proposals: CivicProposal[];
  completedProposalIds: ProposalId[];
  cityDevelopmentLevel: number;
  getProposalById: (proposalId: ProposalId) => CivicProposal | undefined;
  getUnlockedProposals: (playerReputation: number) => CivicProposal[];
  resolveProposal: (proposalId: ProposalId, playerReputation: number) => { success: boolean; message?: string };
  resetProgress: () => void;
}>((set, get) => {
  const calculateCityDevelopment = (completedIds: ProposalId[]) => {
    const resilience = useResilienceStore.getState();
    const rawResilience = resilience.cityResilience;
    const completionBonus = completedIds.length * 8;
    return clamp(Math.round(rawResilience + completionBonus), 0, 100);
  };

  return {
    proposals: CIVIC_PROPOSALS,
    completedProposalIds: [],
    cityDevelopmentLevel: 0,
    getProposalById: (proposalId) => get().proposals.find((proposal) => proposal.id === proposalId),
    getUnlockedProposals: (playerReputation) =>
      get().proposals.filter((proposal) => proposal.requiredReputation <= playerReputation),
    resolveProposal: (proposalId, playerReputation) => {
      const proposal = get().getProposalById(proposalId);
      if (!proposal) {
        return { success: false, message: "Proposal not found." };
      }

      if (get().completedProposalIds.includes(proposalId)) {
        return { success: false, message: "Proposal already completed." };
      }

      if (playerReputation < proposal.requiredReputation) {
        return {
          success: false,
          message: `Reputation requirement not met: ${proposal.requiredReputation} needed.`,
        };
      }

      const resilienceStore = useResilienceStore.getState();
      resilienceStore.applyProposalImpact(proposal.districtId, proposal.effect);

      const updatedCompleted = [...get().completedProposalIds, proposalId];
      const nextDevelopmentLevel = calculateCityDevelopment(updatedCompleted);

      set({
        completedProposalIds: updatedCompleted,
        cityDevelopmentLevel: nextDevelopmentLevel,
      });

      return {
        success: true,
        message: `${proposal.title} has been approved and is now improving the city.`,
      };
    },
    resetProgress: () => {
      set({
        completedProposalIds: [],
        cityDevelopmentLevel: 0,
      });
    },
  };
});
