import { pgTable, uuid, text, integer, jsonb, timestamp, boolean, primaryKey } from "drizzle-orm/pg-core";

/**
 * Citizen progress — one row per authenticated user.
 * Linked to auth.users.id. See drizzle/migrations/0001_citizens.sql.
 */
export const citizens = pgTable("citizens", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull().default("Citizen"),
  avatarInitials: text("avatar_initials").notNull().default("CI"),
  balance: integer("balance").notNull().default(2450),
  reputation: integer("reputation").notNull().default(24),
  cityDay: integer("city_day").notNull().default(1),
  completedJobs: jsonb("completed_jobs").$type<string[]>().notNull().default([]),
  purchasedGoods: jsonb("purchased_goods").$type<string[]>().notNull().default([]),
  votedFor: text("voted_for"),
  doneCourses: jsonb("done_courses").$type<string[]>().notNull().default([]),
  likedPosts: jsonb("liked_posts").$type<string[]>().notNull().default([]),
  /** 0–100 heat; wanted stars derived client-side */
  heatPoints: integer("heat_points").notNull().default(0),
  /** GearLoadout JSON: equipped, unlocked[], ammo{} */
  gear: jsonb("gear")
    .$type<{
      equipped: string;
      unlocked: string[];
      ammo: Record<string, number>;
    }>()
    .notNull()
    .default({
      equipped: "none",
      unlocked: ["none", "stun"],
      ammo: { sidearm: 0, carbine: 0, stun: 12 },
    }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Town Square posts — realtime social feed.
 * See drizzle/migrations/0002_living_city.sql
 */
export const townPosts = pgTable("town_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id"),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  likes: integer("likes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Presence heartbeats — who is currently in the city.
 */
export const presence = pgTable("presence", {
  userId: uuid("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  districtId: text("district_id"),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Scheduled city events (notices, weather, market, civic, celebration).
 */
export const cityEvents = pgTable("city_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  eventType: text("event_type").notNull().default("notice"),
  startsOnDay: integer("starts_on_day").notNull(),
  endsOnDay: integer("ends_on_day").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Civic vote proposals for the current season.
 */
export const voteProposals = pgTable("vote_proposals", {
  id: text("id").primaryKey(),
  season: text("season").notNull().default("003"),
  title: text("title").notNull(),
  blurb: text("blurb").notNull(),
  voteCount: integer("vote_count").notNull().default(0),
  status: text("status").notNull().default("open"),
  closesOnDay: integer("closes_on_day").notNull().default(7),
  outcomeNote: text("outcome_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One vote per citizen per season.
 */
export const citizenVotes = pgTable(
  "citizen_votes",
  {
    citizenId: uuid("citizen_id").notNull(),
    proposalId: text("proposal_id").notNull(),
    season: text("season").notNull().default("003"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.citizenId, t.season] }),
  }),
);
