import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  Bell,
  BookOpen,
  Briefcase,
  Check,
  ChevronRight,
  Coins,
  Heart,
  Landmark,
  LogIn,
  LogOut,
  MapPin,
  Megaphone,
  Send,
  ShoppingBag,
  Sparkles,
  Store,
  Vote,
  X,
} from "lucide-react";
import AfroMetaverseScene from "@/components/afrometaverse/AfroMetaverseScene";
import { CharacterPreview } from "@/components/afrometaverse/characters/CharacterPreview";
import AuthModal from "@/components/afrometaverse/AuthModal";
import { MISSIONS, missionToActive } from "@/data/missions";
import { useCitizenAuth } from "@/hooks/useCitizenAuth";
import { useCityLive } from "@/hooks/useCityLive";
import { useEconomyStore } from "@/stores/economyStore";
import { useResilienceStore } from "@/stores/resilienceStore";
import {
  DISTRICT_WORLD,
  GEAR_LABEL,
  SAFEHOUSES,
  TRANSPORT_LABEL,
  useRoamStore,
  type GearId,
  type TransportId,
} from "@/stores/roamStore";
import { useSocialStateStore } from "@/stores/socialStateStore";
import { useWeatherStore } from "@/stores/weatherStore";
import { useWorldStateStore } from "@/stores/worldStateStore";
import {
  BODY_SHAPE_LABEL,
  CLOTHING_CATALOG,
  SKIN_TONES,
  hydrateCharacterStore,
  useCharacterStore,
  type BodyShape,
  type Gender,
  type HairStyle,
  type HeightId,
} from "@/stores/characterStore";
import { matchOutfit, matchTierColor } from "@/lib/outfitMatching";

type ScreenId = "city" | "work" | "market" | "civic" | "social" | "learn";
type WeatherId = "dry" | "rainy" | "harmattan";
type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

const NAV: { id: ScreenId; label: string; icon: typeof MapPin }[] = [
  { id: "city", label: "City", icon: MapPin },
  { id: "work", label: "Work", icon: Briefcase },
  { id: "market", label: "Market", icon: Store },
  { id: "civic", label: "Civic", icon: Vote },
  { id: "social", label: "Town Square", icon: Megaphone },
  { id: "learn", label: "Learn", icon: BookOpen },
];

const TIME_OF_DAY: { key: TimeOfDay; label: string; note: string }[] = [
  { key: "morning", label: "Morning", note: "The city wakes up with a bright, busy start." },
  { key: "afternoon", label: "Afternoon", note: "Street heat climbs and trade peaks in the lanes." },
  { key: "evening", label: "Evening", note: "Sunlight softens and evening trade begins." },
  { key: "night", label: "Night", note: "Lantern light settles over the roads and ferries." },
];

const WEATHER_STATES: {
  id: WeatherId;
  label: string;
  icon: string;
  temp: number;
  summary: string;
  sky: string;
  glow: string;
  risk: string;
}[] = [
  {
    id: "dry",
    label: "Dry",
    icon: "☀️",
    temp: 31,
    summary: "Warm and clear with bright streets and open views.",
    sky: "linear-gradient(180deg, rgba(255,214,102,0.7), rgba(255,255,255,0.18))",
    glow: "rgba(255, 190, 68, 0.18)",
    risk: "Roads are clear and traffic feels lighter.",
  },
  {
    id: "rainy",
    label: "Rainy",
    icon: "🌧️",
    temp: 27,
    summary: "Short downpours sweep the city and slick the market roads.",
    sky: "linear-gradient(180deg, rgba(56,189,248,0.56), rgba(15,23,42,0.18))",
    glow: "rgba(59, 130, 246, 0.14)",
    risk: "Creekside and low-lying lanes carry the most splash and slip risk.",
  },
  {
    id: "harmattan",
    label: "Harmattan",
    icon: "🌫️",
    temp: 29,
    summary: "Dry winds and dusty haze settle over the city.",
    sky: "linear-gradient(180deg, rgba(168,85,247,0.5), rgba(15,23,42,0.18))",
    glow: "rgba(202, 138, 4, 0.12)",
    risk: "Air feels dry and visibility drops along the waterfront.",
  },
];

const DISTRICTS = [
  {
    id: "town-market",
    name: "Town Market",
    x: 24,
    y: 58,
    tag: "Trade",
    blurb: "Miles One market road: pepper stalls, ankara bolts, okra by the basin.",
    tip: "Most jobs and goods flow through here. Start your day where the crowd is.",
  },
  {
    id: "civic-centre",
    name: "Civic Centre",
    x: 52,
    y: 34,
    tag: "Civic",
    blurb: "The old assembly hall where the community council posts weekly votes.",
    tip: "One vote per citizen. Your say shapes next season's city projects.",
  },
  {
    id: "creekside",
    name: "Creekside",
    x: 30,
    y: 26,
    tag: "Waterfront",
    blurb: "Stilt houses and canoe ferries crossing the mangrove channels.",
    tip: "Ferry work pays well but the tide decides your shift.",
  },
  {
    id: "port",
    name: "The Port",
    x: 74,
    y: 62,
    tag: "Industry",
    blurb: "Container cranes over the Bonny channel, ledgers stacked three deep.",
    tip: "Steady, higher-paying shifts for citizens with a good reputation.",
  },
];

const JOBS = [
  {
    id: "j1",
    title: "Market stall helper",
    district: "Town Market",
    districtId: "town-market",
    coins: 120,
    rep: 1,
    blurb: "Unload okra basins and mind the stall while Mama Ngo runs deliveries.",
  },
  {
    id: "j2",
    title: "Ferry deckhand",
    district: "Creekside",
    districtId: "creekside",
    coins: 180,
    rep: 2,
    blurb: "Two crossings before dusk. Help passengers board and bail the deck.",
  },
  {
    id: "j3",
    title: "Port inventory clerk",
    district: "The Port",
    districtId: "port",
    coins: 240,
    rep: 2,
    blurb: "Count crates against the manifest. Requires a steady hand and patience.",
  },
];

const GOODS = [
  { id: "g1", name: "Suya spice mix", price: 60, emoji: "🌶️", note: "Ground fresh at stall 14." },
  { id: "g2", name: "Bole & fish plate", price: 95, emoji: "🐟", note: "Grilled roadside, eat while hot." },
  { id: "g3", name: "Ankara remnant", price: 210, emoji: "🧵", note: "Six yards of yesterday's print." },
];

const PROPOSALS = [
  {
    id: "p1",
    title: "Solar lamps along Creek Road",
    blurb: "Forty standing lamps between the jetty and the market gate, lit by sundown.",
    votes: 612,
  },
  {
    id: "p2",
    title: "Hourly weekend ferries",
    blurb: "Run the Creekside crossing every hour on Saturdays and Sundays.",
    votes: 488,
  },
];

const COURSES = [
  {
    id: "c1",
    title: "Read a market ledger",
    minutes: 8,
    reward: 40,
    lesson:
      "Every stall keeps two columns: what came in, what went out. If the left column grows faster than the coins on the right, someone is eating the profit. Practice by copying one day of Mama Ngo's ledger.",
  },
  {
    id: "c2",
    title: "Tides of the creek",
    minutes: 12,
    reward: 60,
    lesson:
      "The water rises twice a day and the ferry schedule bends around it. Low tide strands canoes on the mud; high tide floods the lower jetty. Learn the rhythm and you will never miss a crossing.",
  },
  {
    id: "c3",
    title: "Write a civic proposal",
    minutes: 15,
    reward: 80,
    lesson:
      "A good proposal names one problem, one place, and one fix. 'Dark road' becomes 'solar lamps on Creek Road between the jetty and the market gate.' Say who pays, who maintains, and how neighbours will benefit.",
  },
];

const STARTING_POSTS = [
  {
    id: "s1",
    author: "Mama Ngo",
    text: "Suya spice sold out before noon. Tomorrow I triple the batch — come early, Town Market stall 14.",
    likes: 24,
  },
  {
    id: "s2",
    author: "Tobi the Ferryman",
    text: "Creek tide is kind today. Two extra crossings if anyone wants deck experience.",
    likes: 17,
  },
  {
    id: "s3",
    author: "Adaeze",
    text: "Voted on Community Vote 003. Creek Road lamps have my voice — the walk home is too dark.",
    likes: 31,
  },
];

const FEED_LIMIT = 280;

function clampPost(text: string) {
  return text.length > FEED_LIMIT ? text.slice(0, FEED_LIMIT) : text;
}

function getDistrictWeatherNote(districtId: string | undefined, weatherId: WeatherId, timeOfDay: TimeOfDay) {
  if (!districtId) return "City routes are moving normally.";

  if (weatherId === "rainy" && districtId === "creekside") {
    return "Puddles at the jetty and slick wooden planks may delay ferry work.";
  }

  if (weatherId === "harmattan" && districtId === "town-market") {
    return "Dust and haze make the market feel slower and drier than usual.";
  }

  if (weatherId === "rainy" && districtId === "town-market") {
    return "The market lane is slick; keep a steady path between the stalls.";
  }

  if (timeOfDay === "night" && districtId === "port") {
    return "Night shifts are quieter, but cranes still hum through the channel.";
  }

  return "Conditions are steady in this district. The city remains open for business.";
}

export function AfroMetaverseGame() {
  const {
    user,
    isAuthenticated,
    progress,
    loading: authLoading,
    saving,
    lastSavedAt,
    authError,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    saveProgress,
    updateDisplayName,
  } = useCitizenAuth();

  const [screen, setScreen] = useState<ScreenId>("city");
  const [balance, setBalance] = useState(2450);
  const [reputation, setReputation] = useState(24);
  const [cityDay, setCityDay] = useState(1);
  const [completedJobs, setCompletedJobs] = useState<string[]>([]);
  const [purchasedGoods, setPurchasedGoods] = useState<string[]>([]);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [doneCourses, setDoneCourses] = useState<string[]>([]);
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>("town-market");
  const [postDraft, setPostDraft] = useState("");
  const [localPosts, setLocalPosts] = useState(STARTING_POSTS);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const hydratedFromServer = useRef(false);

  function formatSavedAt(date: Date | null) {
    if (!date) return "Not saved yet";
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 15_000) return "Just now";
    if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s ago`;
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  async function commitDisplayName() {
    const next = nameDraft.trim();
    if (!next || next === progress.displayName) {
      setEditingName(false);
      return;
    }
    const ok = await updateDisplayName(next);
    setEditingName(false);
    if (ok) announce(`Name updated to ${next}.`);
    else announce("Could not update name — try again.");
  }

  const weatherStore = useWeatherStore((state) => state);
  const worldState = useWorldStateStore((state) => state.state);
  const resilienceStore = useResilienceStore((state) => state);
  const economyStore = useEconomyStore((state) => state.state);
  const roamMode = useRoamStore((s) => s.mode);
  const roamTransport = useRoamStore((s) => s.transport);
  const nearDistrictId = useRoamStore((s) => s.nearDistrictId);
  const activeMission = useRoamStore((s) => s.activeMission);
  const missionLog = useRoamStore((s) => s.missionLog);
  const wantedLevel = useRoamStore((s) => s.wantedLevel);
  const heatPoints = useRoamStore((s) => s.heatPoints);
  const gear = useRoamStore((s) => s.gear);
  const showMinimap = useRoamStore((s) => s.showMinimap);
  const nearVehicleId = useRoamStore((s) => s.nearVehicleId);
  const mountedVehicleId = useRoamStore((s) => s.mountedVehicleId);
  const inSafehouseId = useRoamStore((s) => s.inSafehouseId);
  const worldVehicles = useRoamStore((s) => s.worldVehicles);
  const enterNearestVehicle = useRoamStore((s) => s.enterNearestVehicle);

  const exitVehicle = useRoamStore((s) => s.exitVehicle);

  const appearance = useCharacterStore((s) => s.appearance);
  const equipped = useCharacterStore((s) => s.equipped);
  const ownedClothes = useCharacterStore((s) => s.owned);
  const setGender = useCharacterStore((s) => s.setGender);
  const setBodyShape = useCharacterStore((s) => s.setBodyShape);
  const setHeight = useCharacterStore((s) => s.setHeight);
  const setSkin = useCharacterStore((s) => s.setSkin);
  const setHair = useCharacterStore((s) => s.setHair);
  const setHairColor = useCharacterStore((s) => s.setHairColor);
  const equipItem = useCharacterStore((s) => s.equip);
  const ownItem = useCharacterStore((s) => s.ownItem);
  const canWear = useCharacterStore((s) => s.canWear);

  useEffect(() => {
    hydrateCharacterStore();
  }, []);

  // Client-side persistence for heat / gear (Cloud citizen row optional later)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("am-roam-v1");
      if (!raw) return;
      const data = JSON.parse(raw) as {
        heatPoints?: number;
        gear?: { equipped: string; unlocked: string[]; ammo: Record<string, number> };
      };
      const st = useRoamStore.getState();
      if (typeof data.heatPoints === "number") {
        st.coolHeat(100);
        if (data.heatPoints > 0) st.addHeat(data.heatPoints);
      }
      if (data.gear?.equipped) {
        for (const id of data.gear.unlocked ?? []) {
          st.unlockGear(id as import("@/stores/roamStore").GearId);
        }
        st.equipGear(data.gear.equipped as import("@/stores/roamStore").GearId);
      }
    } catch {
      /* ignore corrupt */
    }
  }, []);

  useEffect(() => {
    const unsub = useRoamStore.subscribe((s) => {
      try {
        localStorage.setItem(
          "am-roam-v1",
          JSON.stringify({
            heatPoints: s.heatPoints,
            gear: s.gear,
          }),
        );
      } catch {
        /* quota */
      }
    });
    return unsub;
  }, []);

  const setRoamMode = useRoamStore((s) => s.setMode);
  const setTransport = useRoamStore((s) => s.setTransport);
  const startMission = useRoamStore((s) => s.startMission);
  const completeStep = useRoamStore((s) => s.completeStep);
  const completeSubStep = useRoamStore((s) => s.completeSubStep);
  const clearMission = useRoamStore((s) => s.clearMission);
  const setRoamPosition = useRoamStore((s) => s.setPosition);
  const addHeat = useRoamStore((s) => s.addHeat);
  const coolHeat = useRoamStore((s) => s.coolHeat);
  const equipGear = useRoamStore((s) => s.equipGear);
  const unlockGear = useRoamStore((s) => s.unlockGear);
  const toggleMinimap = useRoamStore((s) => s.toggleMinimap);

  const displayNameEarly = isAuthenticated ? progress.displayName : "Ekene Okoro";
  const {
    posts: livePosts,
    events: cityEvents,
    proposals: liveProposals,
    onlineCount,
    liveReady,
    publishPost,
    likeRemotePost,
    castLiveVote,
  } = useCityLive({
    enabled: isAuthenticated,
    userId: user?.id ?? null,
    displayName: displayNameEarly,
    districtId: selectedDistrict,
    cityDay,
    fallbackPosts: STARTING_POSTS,
    fallbackProposals: PROPOSALS.map((p) => ({
      id: p.id,
      title: p.title,
      blurb: p.blurb,
      votes: p.votes,
      status: "open",
      closesOnDay: 7,
      outcomeNote: null,
    })),
  });

  const posts = isAuthenticated && liveReady ? livePosts : localPosts;
  const proposals = isAuthenticated && liveProposals.length > 0 ? liveProposals : PROPOSALS.map((p) => ({
    id: p.id,
    title: p.title,
    blurb: p.blurb,
    votes: p.votes,
    status: "open" as const,
    closesOnDay: 7,
    outcomeNote: null as string | null,
  }));
  const socialState = useSocialStateStore((state) => state.state);

  // Hydrate local game state once when authenticated progress loads
  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    if (hydratedFromServer.current) return;
    hydratedFromServer.current = true;
    setBalance(progress.balance);
    setReputation(progress.reputation);
    setCityDay(progress.cityDay);
    setCompletedJobs(progress.completedJobs);
    setPurchasedGoods(progress.purchasedGoods);
    setVotedFor(progress.votedFor);
    setDoneCourses(progress.doneCourses);
    setLikedPosts(progress.likedPosts);
    if (progress.cityDay > 1) {
      useWeatherStore.getState().setDay(progress.cityDay);
      useWorldStateStore.getState().updateWorldState(progress.cityDay);
    }
  }, [authLoading, isAuthenticated, progress]);

  // Reset hydration flag on sign-out so next login reloads
  useEffect(() => {
    if (!isAuthenticated) {
      hydratedFromServer.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setCityDay(worldState.day);
  }, [worldState.day]);

  useEffect(() => {
    useEconomyStore.getState().syncEconomy();
    useSocialStateStore.getState().syncSocialState();
  }, [worldState.day, worldState.currentDisaster, weatherStore.state.weatherId]);

  useEffect(() => {
    return () => window.clearTimeout(toastTimer.current);
  }, []);

  function announce(text: string) {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }

  function persist(partial: {
    balance?: number;
    reputation?: number;
    cityDay?: number;
    completedJobs?: string[];
    purchasedGoods?: string[];
    votedFor?: string | null;
    doneCourses?: string[];
    likedPosts?: string[];
  }) {
    if (!isAuthenticated) return;
    void saveProgress(partial).then((ok) => {
      if (!ok) announce("Could not save progress — check your connection.");
    });
  }

  const displayName = isAuthenticated ? progress.displayName : "Ekene Okoro";
  const avatarInitials = isAuthenticated ? progress.avatarInitials : "EO";
  const level = Math.min(99, 1 + Math.floor(reputation / 10));
  const levelLabel = `Level ${String(level).padStart(2, "0")}`;
  const repPct = Math.min(100, (reputation % 10) * 10 || (reputation === 0 ? 0 : 100));
  const activeDistrict = DISTRICTS.find((d) => d.id === selectedDistrict) ?? null;
  const timeOfDay = TIME_OF_DAY.find((entry) => entry.key === weatherStore.state.timeOfDay) ?? TIME_OF_DAY[0];
  const weather = WEATHER_STATES.find((entry) => entry.id === weatherStore.state.weatherId) ?? WEATHER_STATES[0];
  const districtWeatherNote = getDistrictWeatherNote(activeDistrict?.id, weather.id as WeatherId, timeOfDay.key);
  const cityPulseText =
    worldState.globalEvents[0] ??
    socialState.feed[0] ??
    `${timeOfDay.label} conditions: ${weather.summary} ${weather.risk}`;

  function buyClothes(itemId: string) {
    const item = CLOTHING_CATALOG.find((c) => c.id === itemId);
    if (!item) return;
    if (ownedClothes.includes(itemId)) {
      if (!canWear(item)) {
        announce("That piece does not match your character gender.");
        return;
      }
      equipItem(itemId);
      announce(`Equipped ${item.name}`);
      return;
    }
    const level = Math.min(99, 1 + Math.floor(reputation / 10));
    if (level < item.minLevel) {
      announce(`Reach Level ${item.minLevel} to unlock ${item.name}`);
      return;
    }
    if (balance < item.price) {
      announce("Not enough City Coins for that piece.");
      return;
    }
    if (!canWear(item)) {
      announce("That piece is for a different gender presentation.");
      return;
    }
    const nextBalance = balance - item.price;
    setBalance(nextBalance);
    ownItem(itemId);
    equipItem(itemId);
    const fit = matchOutfit(useCharacterStore.getState().equipped);
    announce(
      `Bought ${item.name} for ${item.price} City Coins` +
        (fit.score >= 70 ? ` · look is ${fit.label}` : ""),
    );
    persist({ balance: nextBalance });
  }

    function go(next: ScreenId) {
    setScreen(next);
    setMobileNavOpen(false);
  }

  function beginMission(jobId: string) {
    const def = MISSIONS.find((j) => j.id === jobId);
    if (!def || completedJobs.includes(jobId)) return;
    if (activeMission) {
      announce("Finish or cancel your current mission first.");
      return;
    }
    if (def.requiredGear && def.requiredGear !== "none") {
      if (!gear.unlocked.includes(def.requiredGear)) {
        announce(`You need ${GEAR_LABEL[def.requiredGear]} unlocked for this job.`);
        return;
      }
      if (gear.equipped !== def.requiredGear) {
        equipGear(def.requiredGear);
      }
    }
    if (def.kind === "heat" && wantedLevel >= 4) {
      announce("Heat is too high — cool off before taking this job.");
      return;
    }
    startMission(missionToActive(def));
    setRoamPosition([0, 0.6, 6]);
    setSelectedDistrict(def.districtId);
    setScreen("city");
    setRoamMode("walk");
    announce(`Mission: ${def.title}. Nested objectives unlock on site.`);
  }

  function advanceMissionObjective() {
    const mission = useRoamStore.getState().activeMission;
    if (!mission) return;
    const def = MISSIONS.find((j) => j.id === mission.jobId);
    if (!def) return;

    const current = mission.steps.find((s) => !s.done);
    if (!current) {
      // All steps done — payout
      const nextDay = cityDay + 1;
      useWeatherStore.getState().advanceDay();
      useWorldStateStore.getState().updateWorldState(nextDay);
      const nextJobs = [...completedJobs, def.id];
      const coins = Math.round(
        def.coins *
          (economyStore[def.district.toLowerCase().replace(/ /g, "-") as keyof typeof economyStore]?.jobMultiplier ?? 1),
      );
      const nextBalance = balance + coins;
      const nextRep = Math.max(0, Math.min(99, reputation + def.rep));
      setCompletedJobs(nextJobs);
      setBalance(nextBalance);
      setReputation(nextRep);
      setCityDay(nextDay);
      if (mission.heatOnSuccess > 0) addHeat(mission.heatOnSuccess);
      else if (mission.kind === "legal") coolHeat(8);
      if (def.kind === "grey" && !gear.unlocked.includes("sidearm")) {
        unlockGear("sidearm");
      }
      if (def.kind === "heat" && !gear.unlocked.includes("carbine")) {
        unlockGear("carbine");
      }
      let dropLine = "";
      if (def.rewardOutfit) {
        const piece = CLOTHING_CATALOG.find((c) => c.id === def.rewardOutfit);
        if (piece && !ownedClothes.includes(piece.id)) {
          ownItem(piece.id);
          dropLine = ` · outfit drop: ${piece.name}`;
        } else if (piece) {
          dropLine = ` · ${piece.name} already owned`;
        }
      }
      clearMission();
      announce(
        `${def.title} complete — +${coins} coins` +
          (mission.heatOnSuccess > 0 ? ` · heat +${mission.heatOnSuccess}` : "") +
          dropLine,
      );
      persist({
        completedJobs: nextJobs,
        balance: nextBalance,
        reputation: nextRep,
        cityDay: nextDay,
      });
      return;
    }

    if (nearDistrictId !== current.districtId && nearDistrictId !== def.districtId) {
      announce(`Go to ${DISTRICT_WORLD[current.districtId]?.name ?? current.districtId} first.`);
      return;
    }

    // Nested sub-objectives first
    const openSub = current.subSteps?.find((s) => !s.done);
    if (openSub) {
      completeSubStep(current.id, openSub.id);
      announce(openSub.label);
      // If parent auto-completes via all subs, message
      const refreshed = useRoamStore.getState().activeMission;
      const stepNow = refreshed?.steps.find((s) => s.id === current.id);
      if (stepNow?.done) announce(`Segment complete: ${current.label}`);
      return;
    }

    completeStep(current.id);
    announce(current.label);
  }

  /** Instant complete for guests who prefer the old one-click flow */
  function workJob(jobId: string) {
    const job = JOBS.find((j) => j.id === jobId);
    if (!job || completedJobs.includes(jobId)) return;

    // Prefer mission roam if player is in free-walk mode or already on a path
    if (roamMode !== "orbit") {
      beginMission(jobId);
      return;
    }

    const nextDay = cityDay + 1;
    useWeatherStore.getState().advanceDay();
    useWorldStateStore.getState().updateWorldState(nextDay);

    const nextJobs = [...completedJobs, jobId];
    const coins = Math.round(
      job.coins *
        (economyStore[job.district.toLowerCase().replace(/ /g, "-") as keyof typeof economyStore]?.jobMultiplier ?? 1),
    );
    const nextBalance = balance + coins;
    const nextRep = Math.min(99, reputation + job.rep);

    setCompletedJobs(nextJobs);
    setBalance(nextBalance);
    setReputation(nextRep);
    setCityDay(nextDay);
    announce(`Shift done — ${job.coins} City Coins earned at ${job.district}.`);
    persist({
      completedJobs: nextJobs,
      balance: nextBalance,
      reputation: nextRep,
      cityDay: nextDay,
    });
  }

  function buyGood(goodId: string) {
    const good = GOODS.find((g) => g.id === goodId);
    if (!good || purchasedGoods.includes(goodId)) return;
    if (balance < good.price) {
      announce("Not enough City Coins — take a shift at the Work desk first.");
      return;
    }
    const nextGoods = [...purchasedGoods, goodId];
    const nextBalance = balance - good.price;
    setPurchasedGoods(nextGoods);
    setBalance(nextBalance);
    announce(`Purchased ${good.name} for ${good.price} City Coins.`);
    persist({ purchasedGoods: nextGoods, balance: nextBalance });
  }

  async function castVote(proposalId: string) {
    if (votedFor) {
      announce("You have already voted this season — one vote per citizen.");
      return;
    }
    const proposal = proposals.find((p) => p.id === proposalId);
    if (proposal && proposal.status !== "open") {
      announce("This vote is closed for the season.");
      return;
    }
    if (isAuthenticated) {
      const ok = await castLiveVote(proposalId);
      if (!ok) {
        announce("Could not record vote on the city ledger — try again.");
        return;
      }
    }
    const nextRep = Math.min(99, reputation + 2);
    setVotedFor(proposalId);
    setReputation(nextRep);
    announce("Vote recorded for Community Vote 003. Thank you, citizen.");
    persist({ votedFor: proposalId, reputation: nextRep });
  }

  function finishCourse(courseId: string) {
    const course = COURSES.find((c) => c.id === courseId);
    if (!course || doneCourses.includes(courseId)) return;
    const nextCourses = [...doneCourses, courseId];
    const nextBalance = balance + course.reward;
    const nextRep = Math.min(99, reputation + 3);
    setDoneCourses(nextCourses);
    setBalance(nextBalance);
    setReputation(nextRep);
    announce(`Course complete — ${course.reward} City Coins added to your wallet.`);
    persist({ doneCourses: nextCourses, balance: nextBalance, reputation: nextRep });
  }

  async function submitPost() {
    const text = clampPost(postDraft.trim());
    if (!text) return;
    if (isAuthenticated) {
      const remote = await publishPost(text);
      if (!remote) {
        announce("Could not reach the Town Square — check your connection.");
        return;
      }
    } else {
      setLocalPosts((p) => [{ id: `s${Date.now()}`, author: displayName, text, likes: 0 }, ...p]);
    }
    setPostDraft("");
    announce("Posted to the Town Square.");
  }

  async function likePost(postId: string) {
    if (likedPosts.includes(postId)) return;
    const nextLiked = [...likedPosts, postId];
    setLikedPosts(nextLiked);
    if (isAuthenticated) {
      await likeRemotePost(postId);
    } else {
      setLocalPosts((p) => p.map((post) => (post.id === postId ? { ...post, likes: post.likes + 1 } : post)));
    }
    persist({ likedPosts: nextLiked });
  }

  return (
    <div className="am-shell">
      <header className="am-topbar">
        <div className="am-brand">
          <span className="am-brand-mark">A.</span>
          <span className="am-brand-text">
            <strong>AfroMetaverse</strong>
            <small>Your city is alive · Season 01</small>
          </span>
        </div>
        <div className="am-topbar-right">
          <span className="am-live-dot" aria-hidden="true" />
          <span className="am-live-label">Live</span>
          {isAuthenticated ? (
            <span className="am-save-pill" title={lastSavedAt ? lastSavedAt.toLocaleString() : undefined}>
              {saving ? "Saving…" : `Saved · ${formatSavedAt(lastSavedAt)}`}
            </span>
          ) : (
            <span className="am-save-pill am-save-pill-guest">Guest</span>
          )}
          <button className="am-bell" aria-label="Notifications" onClick={() => announce("No new notices. The city is quiet for now.")}>
            <Bell size={16} />
          </button>
          {isAuthenticated ? (
            <button
              type="button"
              className="am-citizen-chip"
              onClick={() => void signOut()}
              title="Sign out"
            >
              <span className="am-citizen-avatar">{avatarInitials}</span>
              <span className="am-citizen-chip-text">
                <strong>{displayName}</strong>
                <small>{levelLabel} · Verified</small>
              </span>
              <LogOut size={14} className="am-verified" />
            </button>
          ) : (
            <button type="button" className="am-citizen-chip" onClick={() => setAuthOpen(true)}>
              <span className="am-citizen-avatar">{avatarInitials}</span>
              <span className="am-citizen-chip-text">
                <strong>{displayName}</strong>
                <small>
                  <LogIn size={11} /> Sign in to save
                </small>
              </span>
            </button>
          )}
        </div>
      </header>

      <div className="am-body">
        <nav className={`am-rail ${mobileNavOpen ? "am-rail-open" : ""}`} aria-label="City navigation">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`am-rail-btn ${screen === item.id ? "am-rail-btn-active" : ""}`}
                onClick={() => go(item.id)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                <ChevronRight size={14} className="am-rail-chevron" />
              </button>
            );
          })}
          <p className="am-rail-note">Season 01 · Day {cityDay}</p>
        </nav>

        <main className="am-main">
          {screen === "city" && (
            <section>
              <div className="am-screen-head">
                <h1>Port Harcourt, Day {cityDay}</h1>
                <p>
                  {roamMode === "orbit"
                    ? "Four hubs, filled streets, empty lots and build sites — room for the city to grow. Free roam with WASD."
                    : "WASD / arrows to move. Reach the glowing district to advance your mission."}
                </p>
              </div>

              <div className="am-roam-bar">
                <button
                  type="button"
                  className={`am-btn ${roamMode === "orbit" ? "am-btn-ghost" : "am-btn-primary"}`}
                  onClick={() => setRoamMode(roamMode === "orbit" ? "walk" : "orbit")}
                >
                  {roamMode === "orbit" ? "Enter free roam" : "Exit free roam"}
                </button>
                {(
                  [
                    "foot",
                    "bicycle",
                    "scooter",
                    "keke",
                    "okada",
                    "taxi",
                    "ferry",
                  ] as TransportId[]
                ).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`am-chip am-transport-chip ${roamTransport === t ? "am-transport-active" : ""}`}
                    onClick={() => {
                      if (t === "foot" && mountedVehicleId) {
                        exitVehicle();
                        announce("On foot");
                        return;
                      }
                      setTransport(t);
                    }}
                    disabled={roamMode === "orbit" || (!!mountedVehicleId && t !== "foot")}
                  >
                    {TRANSPORT_LABEL[t]}
                  </button>
                ))}
                {roamMode !== "orbit" && (
                  <button
                    type="button"
                    className="am-btn am-btn-primary"
                    onClick={() => {
                      if (mountedVehicleId) {
                        exitVehicle();
                        announce("Exited vehicle");
                      } else {
                        const ok = enterNearestVehicle();
                        if (ok) announce("Entered vehicle — WASD to drive, F to exit");
                        else announce("Move closer to a parked vehicle (glow marker)");
                      }
                    }}
                  >
                    {mountedVehicleId ? "Exit vehicle (F)" : nearVehicleId ? "Enter vehicle (F)" : "Enter (near vehicle)"}
                  </button>
                )}
                {inSafehouseId && (
                  <span className="am-chip am-kind am-kind-legal">
                    Safehouse · {SAFEHOUSES.find((s) => s.id === inSafehouseId)?.name ?? "cool-down"}
                  </span>
                )}
                {nearDistrictId && (
                  <span className="am-chip">Near {DISTRICT_WORLD[nearDistrictId]?.name ?? nearDistrictId}</span>
                )}
                <button type="button" className="am-chip am-transport-chip" onClick={() => toggleMinimap()}>
                  {showMinimap ? "Hide map" : "Show map"}
                </button>
                <span className="am-wanted" title={`Heat ${heatPoints}/100`} aria-label={`Wanted level ${wantedLevel}`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className={i < wantedLevel ? "am-star-on" : "am-star-off"}>
                      ★
                    </span>
                  ))}
                </span>
                {wantedLevel > 0 && (
                  <button type="button" className="am-btn am-btn-ghost" onClick={() => coolHeat(15)}>
                    Lay low (−heat)
                  </button>
                )}
                {wantedLevel >= 2 && (
                  <span className="am-chip am-kind am-kind-heat">Patrols active — keep distance or use a safehouse</span>
                )}
              </div>

              <div className="am-gear-bar">
                <span className="am-gear-label">Loadout</span>
                {(Object.keys(GEAR_LABEL) as GearId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`am-chip am-transport-chip ${gear.equipped === id ? "am-transport-active" : ""}`}
                    disabled={!gear.unlocked.includes(id)}
                    onClick={() => equipGear(id)}
                    title={
                      id === "none"
                        ? "Unarmed"
                        : gear.unlocked.includes(id)
                          ? `${GEAR_LABEL[id]} · ammo ${gear.ammo[id as Exclude<GearId, "none">] ?? 0}`
                          : "Locked — unlock via missions"
                    }
                  >
                    {GEAR_LABEL[id]}
                  </button>
                ))}
              </div>

              {activeMission && (
                <div className="am-mission-hud">
                  <div className="am-mission-head">
                    <strong>
                      {activeMission.title}
                      <span className={`am-kind am-kind-${activeMission.kind}`}>{activeMission.kind}</span>
                    </strong>
                    <span>
                      +{activeMission.reward} coins · {activeMission.rep >= 0 ? "+" : ""}
                      {activeMission.rep} rep
                      {activeMission.heatOnSuccess > 0 ? ` · heat +${activeMission.heatOnSuccess}` : ""}
                    </span>
                  </div>
                  <ul className="am-mission-steps">
                    {activeMission.steps.map((step) => (
                      <li key={step.id} className={step.done ? "am-step-done" : ""}>
                        {step.done ? "✓" : "○"} {step.label}
                        {step.subSteps && step.subSteps.length > 0 && (
                          <ul className="am-substeps">
                            {step.subSteps.map((sub) => (
                              <li key={sub.id} className={sub.done ? "am-step-done" : ""}>
                                {sub.done ? "✓" : "·"} {sub.label}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="am-panel-actions">
                    <button type="button" className="am-btn am-btn-primary" onClick={advanceMissionObjective}>
                      Advance objective
                    </button>
                    <button
                      type="button"
                      className="am-btn am-btn-ghost"
                      onClick={() => {
                        const m = useRoamStore.getState().activeMission;
                        if (m && m.heatOnFail > 0) addHeat(Math.floor(m.heatOnFail / 2));
                        clearMission();
                        announce("Mission cancelled.");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  {missionLog[0] && <p className="am-panel-tip">{missionLog[0]}</p>}
                </div>
              )}

              <div
              <div className="am-character-panel">
                <div className="am-character-head">
                  <strong>Your look</strong>
                  <span className="am-panel-tip">Beginners wear a white tee and blue jeans. Drag the preview for 360° · scroll to zoom into stitches, laces, and jewellery.</span>
                </div>
                <CharacterPreview height={300} />
                <div className="am-character-row">
                  <span className="am-gear-label">Gender</span>
                  {(["female", "male"] as Gender[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`am-chip am-transport-chip ${appearance.gender === g ? "am-transport-active" : ""}`}
                      onClick={() => setGender(g)}
                    >
                      {g === "female" ? "Female" : "Male"}
                    </button>
                  ))}
                </div>
                <div className="am-character-row">
                  <span className="am-gear-label">Body</span>
                  {(["slim", "average", "curvy", "athletic", "broad"] as BodyShape[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`am-chip am-transport-chip ${appearance.bodyShape === s ? "am-transport-active" : ""}`}
                      onClick={() => setBodyShape(s)}
                    >
                      {BODY_SHAPE_LABEL[s]}
                    </button>
                  ))}
                </div>
                <div className="am-character-row">
                  <span className="am-gear-label">Height</span>
                  {(["short", "average", "tall"] as HeightId[]).map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={`am-chip am-transport-chip ${appearance.height === h ? "am-transport-active" : ""}`}
                      onClick={() => setHeight(h)}
                    >
                      {h}
                    </button>
                  ))}
                </div>
                <div className="am-character-row">
                  <span className="am-gear-label">Skin</span>
                  {SKIN_TONES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={`am-skin-swatch ${appearance.skin === hex ? "am-skin-active" : ""}`}
                      style={{ background: hex }}
                      onClick={() => setSkin(hex)}
                      aria-label={`Skin ${hex}`}
                    />
                  ))}
                </div>
                <div className="am-character-row">
                  <span className="am-gear-label">Hair</span>
                  {(["short", "afro", "braids", "bob", "bun", "long", "bald"] as HairStyle[]).map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={`am-chip am-transport-chip ${appearance.hair === h ? "am-transport-active" : ""}`}
                      onClick={() => setHair(h)}
                    >
                      {h}
                    </button>
                  ))}
                </div>
                <div className="am-character-row">
                  <span className="am-gear-label">Hair colour</span>
                  {["#1a1a1a", "#3b2f2f", "#6b4423", "#a3e635", "#7c3aed", "#c4c4c4"].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={`am-skin-swatch ${appearance.hairColor === hex ? "am-skin-active" : ""}`}
                      style={{ background: hex }}
                      onClick={() => setHairColor(hex)}
                      aria-label={`Hair ${hex}`}
                    />
                  ))}
                </div>
                <p className="am-panel-tip">
                  Wearing: white tee starter energy ·{" "}
                  {CLOTHING_CATALOG.find((c) => c.id === equipped.top)?.name ?? "Top"} ·{" "}
                  {CLOTHING_CATALOG.find((c) => c.id === equipped.bottom)?.name ?? "Jeans"}
                  {equipped.outer ? ` · ${CLOTHING_CATALOG.find((c) => c.id === equipped.outer)?.name}` : ""}
                  {equipped.hat ? ` · ${CLOTHING_CATALOG.find((c) => c.id === equipped.hat)?.name}` : ""}
                </p>
              </div>

              <div className="am-outfit-match">
                <div className="am-outfit-match-top">
                  <div>
                    <strong>Outfit match</strong>
                    <span className="am-panel-tip">Engine reads colour, style tags, and known sets.</span>
                  </div>
                  <div
                    className="am-outfit-score"
                    style={{ color: matchTierColor(outfitMatch.tier) }}
                  >
                    <span className="am-outfit-score-num">{outfitMatch.score}</span>
                    <span className="am-outfit-score-label">{outfitMatch.label}</span>
                  </div>
                </div>
                <div className="am-character-row">
                  {outfitMatch.tags.map((t) => (
                    <span key={t} className="am-chip">
                      {t}
                    </span>
                  ))}
                  {outfitMatch.bonuses.map((b) => (
                    <span key={b} className="am-chip am-kind am-kind-legal">
                      {b}
                    </span>
                  ))}
                </div>
                {outfitMatch.tips.length > 0 && (
                  <ul className="am-outfit-tips">
                    {outfitMatch.tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                )}
                {(outfitMatch.repBonus > 0 || outfitMatch.coinFindBonus > 0) && (
                  <p className="am-panel-tip">
                    Sharp dressing bonus flavour:{" "}
                    {outfitMatch.repBonus > 0 ? `+${outfitMatch.repBonus} rep presence` : ""}
                    {outfitMatch.repBonus > 0 && outfitMatch.coinFindBonus > 0 ? " · " : ""}
                    {outfitMatch.coinFindBonus > 0
                      ? `+${outfitMatch.coinFindBonus}% chance flair on market finds`
                      : ""}
                  </p>
                )}
              </div>

              <div className="am-wardrobe">
                <div className="am-character-head">
                  <strong>Owned wardrobe</strong>
                  <span className="am-panel-tip">Tap a piece to equip — match score updates with the turntable.</span>
                </div>
                <div className="am-wardrobe-grid">
                  {CLOTHING_CATALOG.filter((c) => ownedClothes.includes(c.id)).map((item) => {
                    const isOn =
                      equipped.top === item.id ||
                      equipped.bottom === item.id ||
                      equipped.outer === item.id ||
                      equipped.shoes === item.id ||
                      equipped.accessory === item.id ||
                      equipped.hat === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`am-wardrobe-item ${isOn ? "am-wardrobe-on" : ""}`}
                        onClick={() => {
                          if (!canWear(item)) {
                            announce("That piece does not match your gender.");
                            return;
                          }
                          equipItem(item.id);
                          announce(`Equipped ${item.name}`);
                        }}
                        title={item.blurb}
                      >
                        <span
                          className="am-wardrobe-swatch"
                          style={{ background: item.color }}
                        />
                        <span className="am-wardrobe-name">{item.name}</span>
                        <span className="am-wardrobe-slot">{item.slot}</span>
                        {isOn && <span className="am-chip am-transport-active">On</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

                className="am-city-wrap am-city-canvas"
                style={{
                  background: weather.sky,
                  boxShadow: `inset 0 0 0 1px oklch(1 0 0 / 0.08), 0 24px 50px ${weather.glow}`,
                }}
              >
                <div
                  className="am-city-overlay"
                  style={{
                    background: `radial-gradient(circle at top, ${weather.glow}, transparent 45%)`,
                  }}
                />
                <AfroMetaverseScene
                  weather={{
                    id: weatherStore.state.weatherId,
                    groundColor: weatherStore.config.groundColor,
                    fogColor: weatherStore.config.fogColor,
                    lightingMultiplier: weatherStore.config.lightingMultiplier,
                    rainIntensity: weatherStore.config.rainIntensity,
                    dustIntensity: weatherStore.config.dustIntensity,
                  }}
                  selectedDistrict={selectedDistrict}
                  onNearDistrict={(id) => {
                    if (id) setSelectedDistrict(id);
                  }}
                  onInteract={(label) => {
                    const districtMap: Record<string, string> = {
                      "Town Market": "town-market",
                      "Civic Centre": "civic-centre",
                      Creekside: "creekside",
                      "The Port": "port",
                    };
                    if (districtMap[label]) {
                      setSelectedDistrict(districtMap[label]);
                      announce(`Arrived sense: ${label}`);
                    } else {
                      announce(label);
                    }
                  }}
                />
                {roamMode === "orbit" &&
                  DISTRICTS.map((d) => (
                    <button
                      key={d.id}
                      className={`am-marker ${selectedDistrict === d.id ? "am-marker-active" : ""}`}
                      style={{ left: `${d.x}%`, top: `${d.y}%` }}
                      onClick={() => setSelectedDistrict(d.id)}
                      aria-label={`Visit ${d.name}`}
                    >
                      <MapPin size={16} />
                      <span>{d.name}</span>
                    </button>
                  ))}
                {roamMode !== "orbit" && (
                  <div className="am-roam-hint">WASD drive · F enter/exit · click hubs · parked vehicles glow when near</div>
                )}
                {showMinimap && (
                  <div className="am-minimap" aria-label="City minimap">
                    <span className="am-minimap-title">Map</span>
                    {DISTRICTS.map((d) => {
                      const world = DISTRICT_WORLD[d.id];
                      const left = world ? ((world.x + 11) / 22) * 100 : d.x;
                      const top = world ? ((world.z + 8) / 17) * 100 : d.y;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          className={`am-minimap-dot ${selectedDistrict === d.id ? "am-minimap-active" : ""} ${nearDistrictId === d.id ? "am-minimap-near" : ""}`}
                          style={{ left: `${left}%`, top: `${top}%` }}
                          title={d.name}
                          onClick={() => setSelectedDistrict(d.id)}
                        />
                      );
                    })}
                    <span
                      className="am-minimap-player"
                      style={{
                        left: `${((useRoamStore.getState().position[0] + 11) / 22) * 100}%`,
                        top: `${((useRoamStore.getState().position[2] + 8) / 17) * 100}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="am-weather-panel">
                <div className="am-weather-left">
                  <span className="am-weather-icon" aria-hidden="true">
                    {weather.icon}
                  </span>
                  <div>
                    <div className="am-weather-meta">Weather</div>
                    <div className="am-weather-label">{weather.label}</div>
                  </div>
                </div>
                <div className="am-weather-right">
                  <div className="am-weather-meta">{timeOfDay.label}</div>
                  <div className="am-weather-temp">{Math.round(weatherStore.state.temperature)}°C</div>
                </div>
              </div>

              {activeDistrict && (
                <div className="am-panel">
                  <div className="am-panel-head">
                    <h2>{activeDistrict.name}</h2>
                    <button
                      className="am-panel-close"
                      onClick={() => setSelectedDistrict(null)}
                      aria-label="Close district panel"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <span className="am-chip">{activeDistrict.tag}</span>
                  <p className="am-panel-blurb">{activeDistrict.blurb}</p>
                  <p className="am-panel-tip">{activeDistrict.tip}</p>
                  <p className="am-panel-tip am-panel-tip-highlight">{districtWeatherNote}</p>
                  <div className="am-panel-actions">
                    <button
                      className="am-btn am-btn-primary"
                      onClick={() =>
                        go(
                          activeDistrict.tag === "Trade"
                            ? "market"
                            : activeDistrict.tag === "Civic"
                              ? "civic"
                              : "work",
                        )
                      }
                    >
                      {activeDistrict.tag === "Trade"
                        ? "Browse the market"
                        : activeDistrict.tag === "Civic"
                          ? "Open the vote"
                          : "Find work here"}
                    </button>
                  </div>
                </div>
              )}
              <p className="am-note">
                Simulation city fabric: occupied blocks, fenced development lots, scaffolds and a port crane — space left for future infrastructure. Districts, jobs and City Coins have no real-world value.
              </p>
            </section>
          )}

          {screen === "work" && (
            <section>
              <div className="am-screen-head">
                <h1>Mission board</h1>
                <p>
                  Legal shifts, grey jobs, and high-heat ops. Each mission has nested objectives — travel, sub-tasks on
                  site, then extract. Wanted stars rise on heat work.
                </p>
              </div>
              <div className="am-cards">
                {MISSIONS.map((job) => {
                  const done = completedJobs.includes(job.id);
                  const lockedGear =
                    job.requiredGear &&
                    job.requiredGear !== "none" &&
                    !gear.unlocked.includes(job.requiredGear);
                  return (
                    <article key={job.id} className={`am-card ${done ? "am-card-done" : ""}`}>
                      <div className="am-card-top">
                        <span className={`am-chip am-kind am-kind-${job.kind}`}>{job.kind}</span>
                        <span className="am-chip">{job.district}</span>
                        <span className="am-coins">
                          <Coins size={14} /> {job.coins}
                        </span>
                      </div>
                      <h2>{job.title}</h2>
                      <p>{job.blurb}
                        {job.rewardOutfit && (
                          <span className="am-panel-tip">
                            {" "}
                            Reward: {CLOTHING_CATALOG.find((c) => c.id === job.rewardOutfit)?.name ?? "outfit"}
                          </span>
                        )}</p>
                      {job.requiredGear && job.requiredGear !== "none" && (
                        <p className="am-panel-tip">Requires {GEAR_LABEL[job.requiredGear]}</p>
                      )}
                      <div className="am-panel-actions">
                        <button
                          className={`am-btn ${done ? "am-btn-ghost" : "am-btn-primary"}`}
                          disabled={done || !!activeMission || !!lockedGear}
                          onClick={() => beginMission(job.id)}
                        >
                          {done ? (
                            <>
                              <Check size={15} /> Done
                            </>
                          ) : lockedGear ? (
                            "Gear locked"
                          ) : (
                            "Start mission"
                          )}
                        </button>
                        {!done && job.kind === "legal" && (
                          <button
                            className="am-btn am-btn-secondary"
                            disabled={!!activeMission}
                            onClick={() => workJob(job.id)}
                          >
                            Quick complete
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              <p className="am-note">
                This is a fictional simulation. Gear, heat, and missions are game systems only and have no real-world
                use.
              </p>
            </section>
          )}

          {screen === "market" && (
            <section>
              <div className="am-screen-head">
                <h1>Town Market</h1>
                <p>Stall goods rotate each day. Your wallet holds {balance.toLocaleString()} City Coins.</p>
              </div>
              <div className="am-cards">
                {GOODS.map((good) => {
                  const owned = purchasedGoods.includes(good.id);
                  return (
                    <article key={good.id} className={`am-card ${owned ? "am-card-done" : ""}`}>
                      <div className="am-card-top">
                        <span className="am-good-emoji" aria-hidden="true">{good.emoji}</span>
                        <span className="am-coins">
                          <Banknote size={14} /> {good.price}
                        </span>
                      </div>
                      <h2>{good.name}</h2>
                      <p>{good.note}</p>
                      <button
                        className={`am-btn ${owned ? "am-btn-ghost" : "am-btn-primary"}`}
                        disabled={owned}
                        onClick={() => buyGood(good.id)}
                      >
                        {owned ? (
                          <>
                            <Check size={15} /> In your satchel
                          </>
                        ) : (
                          "Buy"
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
              
              <div className="am-screen-head" style={{ marginTop: 28 }}>
                <h2>Fashion stall</h2>
                <p>
                  New citizens start in a white T-shirt and blue jeans. Earn City Coins and level up to buy coats,
                  hats, and ornaments. Equip anything you own.
                </p>
              </div>
              <div className="am-cards">
                {CLOTHING_CATALOG.filter((c) => c.price > 0).map((item) => {
                  const owned = ownedClothes.includes(item.id);
                  const level = Math.min(99, 1 + Math.floor(reputation / 10));
                  const locked = level < item.minLevel;
                  const genderBlock = !canWear(item);
                  return (
                    <article key={item.id} className={`am-card ${owned ? "am-card-done" : ""}`}>
                      <div className="am-card-top">
                        <span className="am-chip">{item.slot}</span>
                        <span className="am-coins">
                          <Banknote size={14} /> {item.price}
                        </span>
                      </div>
                      <h2>{item.name}</h2>
                      <p>{item.blurb}</p>
                      <p className="am-panel-tip">
                        Level {item.minLevel}+
                        {item.gender !== "any" ? ` · ${item.gender}` : " · any"}
                      </p>
                      <div className="am-panel-actions">
                        <button
                          type="button"
                          className={`am-btn ${owned ? "am-btn-secondary" : "am-btn-primary"}`}
                          disabled={genderBlock || (!owned && locked)}
                          onClick={() => buyClothes(item.id)}
                        >
                          {genderBlock
                            ? "Wrong gender"
                            : owned
                              ? "Equip"
                              : locked
                                ? `Locked L${item.minLevel}`
                                : "Buy"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <p className="am-note">Market prices are invented for the simulation and match no real stall.</p>
            </section>
          )}

          {screen === "civic" && (
            <section>
              <div className="am-screen-head">
                <h1>Community Vote 003</h1>
                <p>
                  The council posts one question each season. One vote per citizen, counted at the Civic Centre.
                  {proposals.some((p) => p.status === "open")
                    ? ` Open until Day ${Math.max(...proposals.map((p) => p.closesOnDay))}.`
                    : " This season's vote has closed."}
                </p>
              </div>
              <div className="am-cards">
                {proposals.map((proposal) => {
                  const mine = votedFor === proposal.id;
                  const other = votedFor && votedFor !== proposal.id;
                  const closed = proposal.status !== "open";
                  return (
                    <article
                      key={proposal.id}
                      className={`am-card ${mine ? "am-card-voted" : ""} ${proposal.status === "passed" ? "am-card-passed" : ""}`}
                    >
                      <div className="am-card-top">
                        <span className="am-chip">
                          {proposal.status === "passed"
                            ? "Passed"
                            : proposal.status === "rejected"
                              ? "Not passed"
                              : "Proposal"}
                        </span>
                        <span className="am-votes">{proposal.votes.toLocaleString()} votes</span>
                      </div>
                      <h2>{proposal.title}</h2>
                      <p>{proposal.blurb}</p>
                      {proposal.outcomeNote && (
                        <p className="am-panel-tip am-panel-tip-highlight">{proposal.outcomeNote}</p>
                      )}
                      <button
                        className={`am-btn ${mine ? "am-btn-ghost" : "am-btn-primary"}`}
                        disabled={!!votedFor || closed}
                        onClick={() => void castVote(proposal.id)}
                      >
                        {mine ? (
                          <>
                            <Check size={15} /> Your vote
                          </>
                        ) : closed ? (
                          "Vote closed"
                        ) : other ? (
                          "Vote closed for you"
                        ) : (
                          "Vote for this"
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
              <p className="am-note">
                This vote is part of the game world. It is not connected to any real election and carries no real-world effect.
              </p>
            </section>
          )}

          {screen === "social" && (
            <section>
              <div className="am-screen-head">
                <h1>Town Square</h1>
                <p>
                  What is the city saying today, Day {cityDay}?
                  {isAuthenticated && (
                    <span className="am-presence-line">
                      {" "}
                      · {Math.max(onlineCount, 1)} citizen{onlineCount === 1 ? "" : "s"} nearby
                      {liveReady ? " · live" : ""}
                    </span>
                  )}
                </p>
              </div>
              {cityEvents.length > 0 && (
                <div className="am-events">
                  {cityEvents.map((ev) => (
                    <article key={ev.id} className="am-event-card">
                      <span className="am-chip">{ev.eventType}</span>
                      <strong>{ev.title}</strong>
                      <p>{ev.body}</p>
                    </article>
                  ))}
                </div>
              )}
              <div className="am-compose">
                <textarea
                  className="am-compose-input"
                  placeholder="Share a piece of city news…"
                  value={postDraft}
                  maxLength={FEED_LIMIT}
                  onChange={(e) => setPostDraft(clampPost(e.target.value))}
                  rows={3}
                />
                <div className="am-compose-foot">
                  <span>{FEED_LIMIT - postDraft.length}</span>
                  <button
                    className="am-btn am-btn-primary"
                    onClick={() => void submitPost()}
                    disabled={!postDraft.trim()}
                  >
                    <Send size={15} /> Post
                  </button>
                </div>
              </div>
              <div className="am-feed">
                {posts.map((post) => (
                  <article key={post.id} className="am-post">
                    <div className="am-post-head">
                      <span className="am-post-avatar">{post.author.slice(0, 2).toUpperCase()}</span>
                      <strong>{post.author}</strong>
                    </div>
                    <p>{post.text}</p>
                    <button
                      className={`am-like ${likedPosts.includes(post.id) ? "am-like-active" : ""}`}
                      onClick={() => void likePost(post.id)}
                      disabled={likedPosts.includes(post.id)}
                    >
                      <Heart size={14} /> {post.likes}
                    </button>
                  </article>
                ))}
              </div>
              <p className="am-note">Feed posts are simulated neighbours. Be kind — the town square remembers.</p>
            </section>
          )}

          {screen === "learn" && (
            <section>
              <div className="am-screen-head">
                <h1>Learn</h1>
                <p>Short courses from the Civic Centre library. Each one pays out in City Coins and reputation.</p>
              </div>
              <div className="am-cards">
                {COURSES.map((course) => {
                  const done = doneCourses.includes(course.id);
                  const open = openCourse === course.id;
                  return (
                    <article key={course.id} className={`am-card ${done ? "am-card-done" : ""}`}>
                      <div className="am-card-top">
                        <span className="am-chip">{course.minutes} min</span>
                        <span className="am-coins">
                          <Sparkles size={14} /> {course.reward}
                        </span>
                      </div>
                      <h2>{course.title}</h2>
                      {open && <p className="am-lesson">{course.lesson}</p>}
                      <div className="am-card-actions">
                        <button className="am-btn am-btn-ghost" onClick={() => setOpenCourse(open ? null : course.id)}>
                          {open ? "Hide lesson" : "Read lesson"}
                        </button>
                        <button
                          className={`am-btn ${done ? "am-btn-ghost" : "am-btn-primary"}`}
                          disabled={done}
                          onClick={() => finishCourse(course.id)}
                        >
                          {done ? (
                            <>
                              <Check size={15} /> Completed
                            </>
                          ) : (
                            "Mark complete"
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              <p className="am-note">Course rewards are play money and unlock nothing outside this simulation.</p>
            </section>
          )}
        </main>

        <aside className="am-citizen" aria-label="Citizen card">
          <div className="am-citizen-head">
            <span className="am-citizen-avatar am-citizen-avatar-lg">{avatarInitials}</span>
            <div className="am-citizen-name-block">
              {isAuthenticated && editingName ? (
                <form
                  className="am-name-edit"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void commitDisplayName();
                  }}
                >
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={40}
                    autoFocus
                    aria-label="Display name"
                  />
                  <button type="submit" className="am-btn am-btn-primary">
                    Save
                  </button>
                  <button
                    type="button"
                    className="am-btn am-btn-ghost"
                    onClick={() => setEditingName(false)}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <strong>
                    {displayName}
                    {isAuthenticated && (
                      <button
                        type="button"
                        className="am-name-edit-btn"
                        onClick={() => {
                          setNameDraft(displayName);
                          setEditingName(true);
                        }}
                        aria-label="Edit display name"
                      >
                        Edit
                      </button>
                    )}
                  </strong>
                  <small>
                    {levelLabel} ·{" "}
                    {isAuthenticated ? (
                      <>
                        <BadgeCheck size={11} className="am-verified" />{" "}
                        {saving ? "Saving…" : formatSavedAt(lastSavedAt)}
                      </>
                    ) : (
                      "Guest"
                    )}
                  </small>
                </>
              )}
            </div>
          </div>
          {!isAuthenticated && (
            <button
              type="button"
              className="am-btn am-btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setAuthOpen(true)}
            >
              <LogIn size={15} /> Sign in to save progress
            </button>
          )}
          <div className="am-wallet">
            <span className="am-wallet-label">Wallet</span>
            <span className="am-wallet-amount">
              <Coins size={16} /> {balance.toLocaleString()}
            </span>
            <span className="am-wallet-sub">City Coins</span>
          </div>
          <div className="am-rep">
            <div className="am-rep-row">
              <span>Reputation</span>
              <span>{reputation}</span>
            </div>
            <div className="am-rep-bar">
              <span style={{ width: `${repPct}%` }} />
            </div>
          </div>
          <dl className="am-stats">
            <div>
              <dt>City days</dt>
              <dd>{cityDay}</dd>
            </div>
            <div>
              <dt>Shifts</dt>
              <dd>{completedJobs.length}</dd>
            </div>
            <div>
              <dt>Courses</dt>
              <dd>{doneCourses.length}</dd>
            </div>
          </dl>
          <div className="am-next-move">
            <span className="am-next-label">Next move</span>
            {completedJobs.length === 0 ? (
              <button className="am-btn am-btn-secondary" onClick={() => go("work")}>Take your first shift</button>
            ) : !votedFor ? (
              <button className="am-btn am-btn-secondary" onClick={() => go("civic")}>Cast your civic vote</button>
            ) : doneCourses.length === 0 ? (
              <button className="am-btn am-btn-secondary" onClick={() => go("learn")}>Try a library course</button>
            ) : (
              <button className="am-btn am-btn-secondary" onClick={() => go("market")}>Treat yourself at the market</button>
            )}
          </div>
          <div className="am-pulse">
            <span className="am-pulse-title">City pulse</span>
            <p>{cityPulseText}</p>
          </div>
        </aside>
      </div>

      <nav className="am-nav-mobile" aria-label="City navigation, mobile">
        {NAV.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`am-nav-mobile-btn ${screen === item.id ? "am-nav-mobile-active" : ""}`}
              onClick={() => go(item.id)}
              aria-label={item.label}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {toast && (
        <div key={toast.id} className="am-toast" role="status">
          <Landmark size={15} /> {toast.text}
        </div>
      )}

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        authError={authError}
        onSignInEmail={signInWithEmail}
        onSignUpEmail={signUpWithEmail}
        onSignInGoogle={signInWithGoogle}
      />
    </div>
  );
}

export default AfroMetaverseGame;
