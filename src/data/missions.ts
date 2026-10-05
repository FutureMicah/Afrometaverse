import type { ActiveMission, GearId, MissionKind } from "@/stores/roamStore";

export type MissionDef = {
  id: string;
  title: string;
  district: string;
  districtId: string;
  kind: MissionKind;
  coins: number;
  rep: number;
  blurb: string;
  heatOnSuccess: number;
  heatOnFail: number;
  requiredGear?: GearId;
  /** Nested structure: steps with optional sub-objectives */
  buildSteps: () => NonNullable<ActiveMission>["steps"];
};

export const MISSIONS: MissionDef[] = [
  {
    id: "j1",
    title: "Market stall helper",
    district: "Town Market",
    districtId: "town-market",
    kind: "legal",
    coins: 120,
    rep: 1,
    blurb: "Unload okra basins and mind the stall while Mama Ngo runs deliveries.",
    heatOnSuccess: 0,
    heatOnFail: 0,
    buildSteps: () => [
      {
        id: "arrive",
        label: "Travel to Town Market",
        districtId: "town-market",
        done: false,
      },
      {
        id: "prep",
        label: "Prep the stall",
        districtId: "town-market",
        done: false,
        subSteps: [
          { id: "unload", label: "Unload basins from the cart", done: false },
          { id: "display", label: "Lay out the morning produce", done: false },
        ],
      },
      {
        id: "work",
        label: "Hold the stall until relief arrives",
        districtId: "town-market",
        done: false,
      },
    ],
  },
  {
    id: "j2",
    title: "Ferry deckhand",
    district: "Creekside",
    districtId: "creekside",
    kind: "legal",
    coins: 180,
    rep: 2,
    blurb: "Two crossings before dusk. Help passengers board and bail the deck.",
    heatOnSuccess: 0,
    heatOnFail: 0,
    buildSteps: () => [
      {
        id: "arrive",
        label: "Reach Creekside jetty",
        districtId: "creekside",
        done: false,
      },
      {
        id: "crossings",
        label: "Run the crossings",
        districtId: "creekside",
        done: false,
        subSteps: [
          { id: "board", label: "Board passengers safely", done: false },
          { id: "bail", label: "Bail the deck mid-channel", done: false },
          { id: "dock", label: "Dock and clear the ramp", done: false },
        ],
      },
      {
        id: "work",
        label: "Sign off with the captain",
        districtId: "creekside",
        done: false,
      },
    ],
  },
  {
    id: "j3",
    title: "Port inventory clerk",
    district: "The Port",
    districtId: "port",
    kind: "legal",
    coins: 240,
    rep: 2,
    blurb: "Count crates against the manifest. Requires a steady hand and patience.",
    heatOnSuccess: 0,
    heatOnFail: 0,
    buildSteps: () => [
      {
        id: "arrive",
        label: "Enter the Port yard",
        districtId: "port",
        done: false,
      },
      {
        id: "count",
        label: "Reconcile the manifest",
        districtId: "port",
        done: false,
        subSteps: [
          { id: "aisle-a", label: "Count aisle A crates", done: false },
          { id: "aisle-b", label: "Count aisle B crates", done: false },
          { id: "sign", label: "Sign the ledger", done: false },
        ],
      },
      {
        id: "work",
        label: "File the report",
        districtId: "port",
        done: false,
      },
    ],
  },
  {
    id: "h1",
    title: "Night drop — sealed crates",
    district: "The Port",
    districtId: "port",
    kind: "grey",
    coins: 420,
    rep: -1,
    blurb: "Move unmarked crates before the night supervisor returns. Quiet work. High risk.",
    heatOnSuccess: 18,
    heatOnFail: 35,
    requiredGear: "stun",
    buildSteps: () => [
      {
        id: "arrive",
        label: "Slip into the Port after hours",
        districtId: "port",
        done: false,
      },
      {
        id: "secure",
        label: "Secure the loading bay",
        districtId: "port",
        done: false,
        subSteps: [
          { id: "watch", label: "Watch the gate for patrols", done: false },
          { id: "signal", label: "Signal the truck", done: false },
          { id: "load", label: "Load sealed crates", done: false },
        ],
      },
      {
        id: "exit",
        label: "Leave without drawing heat",
        districtId: "port",
        done: false,
      },
    ],
  },
  {
    id: "h2",
    title: "Creek road interception",
    district: "Creekside",
    districtId: "creekside",
    kind: "heat",
    coins: 520,
    rep: -2,
    blurb: "Stop a convoy on the mangrove road. Bring a sidearm. Expect attention.",
    heatOnSuccess: 40,
    heatOnFail: 55,
    requiredGear: "sidearm",
    buildSteps: () => [
      {
        id: "arrive",
        label: "Stage near Creekside",
        districtId: "creekside",
        done: false,
      },
      {
        id: "setup",
        label: "Set the interception",
        districtId: "creekside",
        done: false,
        subSteps: [
          { id: "block", label: "Block the narrow bend", done: false },
          { id: "disable", label: "Disable the lead vehicle", done: false },
          { id: "secure-cargo", label: "Secure the cargo", done: false },
        ],
      },
      {
        id: "extract",
        label: "Extract before patrols close in",
        districtId: "creekside",
        done: false,
      },
    ],
  },
];

export function missionToActive(def: MissionDef): NonNullable<ActiveMission> {
  return {
    jobId: def.id,
    title: def.title,
    kind: def.kind,
    reward: def.coins,
    rep: def.rep,
    heatOnFail: def.heatOnFail,
    heatOnSuccess: def.heatOnSuccess,
    requiredGear: def.requiredGear,
    steps: def.buildSteps(),
    startedAt: Date.now(),
  };
}
