import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
