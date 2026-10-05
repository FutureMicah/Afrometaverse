import { useEffect, useRef, useState } from "react";
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
  MapPin,
  Megaphone,
  Send,
  ShoppingBag,
  Sparkles,
  Store,
  Vote,
  X,
} from "lucide-react";
import cityImage from "@/assets/port-harcourt-city.jpg";

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
    coins: 120,
    rep: 1,
    blurb: "Unload okra basins and mind the stall while Mama Ngo runs deliveries.",
  },
  {
    id: "j2",
    title: "Ferry deckhand",
    district: "Creekside",
    coins: 180,
    rep: 2,
    blurb: "Two crossings before dusk. Help passengers board and bail the deck.",
  },
  {
    id: "j3",
    title: "Port inventory clerk",
    district: "The Port",
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
      "Every stall keeps two columns: what came in, what went out. If the left column grows faster than the coins on the right, someone is eating the profit. Practice by copying one day of Mama Ngo's ledger before lunch.",
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
      "A good proposal names one problem, one place, and one fix. \"Dark road\" becomes \"solar lamps on Creek Road between the jetty and the market gate\". Say who pays, who maintains, and how neighbours will know the change is working.",
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
  const [screen, setScreen] = useState<ScreenId>("city");
  const [balance, setBalance] = useState(2450);
  const [reputation, setReputation] = useState(24);
  const [cityDay, setCityDay] = useState(1);
  const [completedJobs, setCompletedJobs] = useState<string[]>([]);
  const [purchasedGoods, setPurchasedGoods] = useState<string[]>([]);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [doneCourses, setDoneCourses] = useState<string[]>([]);
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [postDraft, setPostDraft] = useState("");
  const [posts, setPosts] = useState(STARTING_POSTS);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    return () => window.clearTimeout(toastTimer.current);
  }, []);

  function announce(text: string) {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }

  const level = Math.min(99, 1 + Math.floor(reputation / 10));
  const levelLabel = `Level ${String(level).padStart(2, "0")}`;
  const repPct = Math.min(100, (reputation % 10) * 10 || (reputation === 0 ? 0 : 100));
  const activeDistrict = DISTRICTS.find((d) => d.id === selectedDistrict) ?? null;
  const timeOfDay = TIME_OF_DAY[(cityDay - 1) % TIME_OF_DAY.length];
  const weather = WEATHER_STATES[(cityDay - 1) % WEATHER_STATES.length];
  const districtWeatherNote = getDistrictWeatherNote(activeDistrict?.id, weather.id, timeOfDay.key);
  const cityPulseText = `${timeOfDay.label} conditions: ${weather.summary} ${weather.risk}`;

  function go(next: ScreenId) {
    setScreen(next);
    setMobileNavOpen(false);
  }

  function workJob(jobId: string) {
    const job = JOBS.find((j) => j.id === jobId);
    if (!job || completedJobs.includes(jobId)) return;
    setCompletedJobs((c) => [...c, jobId]);
    setBalance((b) => b + job.coins);
    setReputation((r) => Math.min(99, r + job.rep));
    setCityDay((d) => d + 1);
    announce(`Shift done — ${job.coins} City Coins earned at ${job.district}.`);
  }

  function buyGood(goodId: string) {
    const good = GOODS.find((g) => g.id === goodId);
    if (!good || purchasedGoods.includes(goodId)) return;
    if (balance < good.price) {
      announce("Not enough City Coins — take a shift at the Work desk first.");
      return;
    }
    setPurchasedGoods((p) => [...p, goodId]);
    setBalance((b) => b - good.price);
    announce(`Purchased ${good.name} for ${good.price} City Coins.`);
  }

  function castVote(proposalId: string) {
    if (votedFor) {
      announce("You have already voted this season — one vote per citizen.");
      return;
    }
    setVotedFor(proposalId);
    setReputation((r) => Math.min(99, r + 2));
    announce("Vote recorded for Community Vote 003. Thank you, citizen.");
  }

  function finishCourse(courseId: string) {
    const course = COURSES.find((c) => c.id === courseId);
    if (!course || doneCourses.includes(courseId)) return;
    setDoneCourses((d) => [...d, courseId]);
    setBalance((b) => b + course.reward);
    setReputation((r) => Math.min(99, r + 3));
    announce(`Course complete — ${course.reward} City Coins added to your wallet.`);
  }

  function submitPost() {
    const text = clampPost(postDraft.trim());
    if (!text) return;
    setPosts((p) => [{ id: `s${Date.now()}`, author: "Ekene Okoro", text, likes: 0 }, ...p]);
    setPostDraft("");
    announce("Posted to the Town Square.");
  }

  function likePost(postId: string) {
    if (likedPosts.includes(postId)) return;
    setLikedPosts((l) => [...l, postId]);
    setPosts((p) => p.map((post) => (post.id === postId ? { ...post, likes: post.likes + 1 } : post)));
  }

  return (
    <div className="am-shell">
      {/* ---------- Top bar ---------- */}
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
          <button className="am-bell" aria-label="Notifications" onClick={() => announce("No new notices. The city is quiet for now.")}>
            <Bell size={16} />
          </button>
          <div className="am-citizen-chip">
            <span className="am-citizen-avatar">EO</span>
            <span className="am-citizen-chip-text">
              <strong>Ekene Okoro</strong>
              <small>{levelLabel} · Verified</small>
            </span>
            <BadgeCheck size={14} className="am-verified" />
          </div>
        </div>
      </header>

      <div className="am-body">
        {/* ---------- Left rail ---------- */}
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
          <p className="am-rail-note">
            Season 01 · Day {cityDay}
          </p>
        </nav>

        {/* ---------- Main ---------- */}
        <main className="am-main">
          {screen === "city" && (
            <section>
              <div className="am-screen-head">
                <h1>Port Harcourt, Day {cityDay}</h1>
                <p>Tap a marker to visit a district. Every street has something for a citizen on the move.</p>
              </div>
              <div
                className="am-city-wrap"
                style={{
                  background: weather.sky,
                  boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.08), 0 24px 50px ${weather.glow}`,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `radial-gradient(circle at top, ${weather.glow}, transparent 45%)`,
                    pointerEvents: "none",
                  }}
                />
                <img src={cityImage} alt="Isometric illustration of Port Harcourt at midday" className="am-city-img" />
                {DISTRICTS.map((d) => (
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
              </div>

              <div
                className="am-weather-panel"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  marginTop: 16,
                  borderRadius: 18,
                  background: "rgba(17, 24, 39, 0.7)",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  color: "#f8fafc",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span aria-hidden="true" style={{ fontSize: 28 }}>{weather.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2, opacity: 0.75 }}>
                      Weather
                    </div>
                    <strong style={{ fontSize: 18 }}>{weather.label}</strong>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{timeOfDay.label}</div>
                  <strong style={{ fontSize: 24 }}>{weather.temp}°C</strong>
                </div>
              </div>

              {activeDistrict && (
                <div className="am-panel">
                  <div className="am-panel-head">
                    <h2>{activeDistrict.name}</h2>
                    <button className="am-panel-close" onClick={() => setSelectedDistrict(null)} aria-label="Close district panel">
                      <X size={16} />
                    </button>
                  </div>
                  <span className="am-chip">{activeDistrict.tag}</span>
                  <p className="am-panel-blurb">{activeDistrict.blurb}</p>
                  <p className="am-panel-tip">{activeDistrict.tip}</p>
                  <p className="am-panel-tip" style={{ color: "#bae6fd", marginTop: 8 }}>
                    {districtWeatherNote}
                  </p>
                  <div className="am-panel-actions">
                    <button className="am-btn am-btn-primary" onClick={() => go(activeDistrict.tag === "Trade" ? "market" : activeDistrict.tag === "Civic" ? "civic" : "work")}>
                      {activeDistrict.tag === "Trade" ? "Browse the market" : activeDistrict.tag === "Civic" ? "Open the vote" : "Find work here"}
                    </button>
                  </div>
                </div>
              )}
              <p className="am-note">
                This is a simulation. Districts, jobs and City Coins are part of the game and have no real-world value.
              </p>
            </section>
          )}

          {screen === "work" && (
            <section>
              <div className="am-screen-head">
                <h1>Work desk</h1>
                <p>Three honest shifts are posted today. Each completed shift moves the city one day forward.</p>
              </div>
              <div className="am-cards">
                {JOBS.map((job) => {
                  const done = completedJobs.includes(job.id);
                  return (
                    <article key={job.id} className={`am-card ${done ? "am-card-done" : ""}`}>
                      <div className="am-card-top">
                        <span className="am-chip">{job.district}</span>
                        <span className="am-coins">
                          <Coins size={14} /> {job.coins}
                        </span>
                      </div>
                      <h2>{job.title}</h2>
                      <p>{job.blurb}</p>
                      <button
                        className={`am-btn ${done ? "am-btn-ghost" : "am-btn-primary"}`}
                        disabled={done}
                        onClick={() => workJob(job.id)}
                      >
                        {done ? (
                          <>
                            <Check size={15} /> Shift completed
                          </>
                        ) : (
                          "Take this shift"
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
              <p className="am-note">City Coins are play money. They cannot be bought, sold or traded outside this game.</p>
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
              <p className="am-note">Market prices are invented for the simulation and match no real stall.</p>
            </section>
          )}

          {screen === "civic" && (
            <section>
              <div className="am-screen-head">
                <h1>Community Vote 003</h1>
                <p>The council posts one question each season. One vote per citizen, counted at the Civic Centre.</p>
              </div>
              <div className="am-cards">
                {PROPOSALS.map((proposal) => {
                  const mine = votedFor === proposal.id;
                  const other = votedFor && votedFor !== proposal.id;
                  return (
                    <article key={proposal.id} className={`am-card ${mine ? "am-card-voted" : ""}`}>
                      <div className="am-card-top">
                        <span className="am-chip">Proposal</span>
                        <span className="am-votes">{proposal.votes.toLocaleString()} votes</span>
                      </div>
                      <h2>{proposal.title}</h2>
                      <p>{proposal.blurb}</p>
                      <button
                        className={`am-btn ${mine ? "am-btn-ghost" : "am-btn-primary"}`}
                        disabled={!!votedFor}
                        onClick={() => castVote(proposal.id)}
                      >
                        {mine ? (
                          <>
                            <Check size={15} /> Your vote
                          </>
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
                <p>What is the city saying today, Day {cityDay}?</p>
              </div>
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
                  <button className="am-btn am-btn-primary" onClick={submitPost} disabled={!postDraft.trim()}>
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
                      onClick={() => likePost(post.id)}
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

        {/* ---------- Right citizen card ---------- */}
        <aside className="am-citizen" aria-label="Citizen card">
          <div className="am-citizen-head">
            <span className="am-citizen-avatar am-citizen-avatar-lg">EO</span>
            <div>
              <strong>Ekene Okoro</strong>
              <small>
                {levelLabel} · <BadgeCheck size={11} className="am-verified" /> Verified
              </small>
            </div>
          </div>
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

      {/* ---------- Mobile nav ---------- */}
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

      {/* ---------- Toast ---------- */}
      {toast && (
        <div key={toast.id} className="am-toast" role="status">
          <Landmark size={15} /> {toast.text}
        </div>
      )}
    </div>
  );
}

export default AfroMetaverseGame;
