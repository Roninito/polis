/**
 * SQLite schema — Treasury & Ledger
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { orgs } from "./orgs";
import { members } from "./members";

export const treasuries = sqliteTable("treasuries", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  balance: integer("balance").notNull().default(0),
  reserveBalance: integer("reserve_balance").notNull().default(0),
  poolBalance: integer("pool_balance").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  cycleNumber: integer("cycle_number").notNull().default(0),
  cycleStartedAt: text("cycle_started_at"),
  nextPayoutAt: text("next_payout_at"),
  settings: text("settings", { mode: "json" }).default({}),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const ledger = sqliteTable("ledger", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  type: text("type").notNull(),
  memberId: text("member_id").references(() => members.id),
  amount: integer("amount").notNull(),
  balance: integer("balance").notNull(),
  note: text("note"),
  hmac: text("hmac").notNull(),
  cycleRef: integer("cycle_ref"),
  metadata: text("metadata", { mode: "json" }).default({}),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
