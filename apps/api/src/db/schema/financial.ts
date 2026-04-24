/**
 * Financial schema — Treasury & Ledger
 *
 * Ledger is append-only with HMAC integrity signatures.
 * Amounts stored in cents (integer) — never floats.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { orgs } from "./orgs";
import { members } from "./members";

/**
 * Treasury — org-level financial summary
 */
export const treasuries = pgTable("treasuries", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  balance: integer("balance").notNull().default(0),
  reserveBalance: integer("reserve_balance").notNull().default(0),
  poolBalance: integer("pool_balance").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  cycleNumber: integer("cycle_number").notNull().default(0),
  cycleStartedAt: timestamp("cycle_started_at", { mode: "string" }),
  nextPayoutAt: timestamp("next_payout_at", { mode: "string" }),
  settings: jsonb("settings").$defaultFn(() => '{}'),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  orgIdIdx: index("treasuries_org_id_idx").on(table.orgId),
}));

/**
 * Ledger — append-only transaction log with HMAC signing
 *
 * No UPDATE or DELETE ever issued on this table.
 * Each entry includes the running balance after the transaction
 * and an HMAC-SHA256 signature for integrity verification.
 */
export const ledger = pgTable("ledger", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  type: text("type").notNull(),
  // contribution | payout | reserve | penalty | fee | refund | adjustment
  memberId: uuid("member_id").references(() => members.id),
  amount: integer("amount").notNull(),
  balance: integer("balance").notNull(),
  note: text("note"),
  hmac: text("hmac").notNull(),
  cycleRef: integer("cycle_ref"),
  metadata: jsonb("metadata").$defaultFn(() => '{}'),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  orgIdIdx: index("ledger_org_id_idx").on(table.orgId),
  memberIdIdx: index("ledger_member_id_idx").on(table.memberId),
  typeIdx: index("ledger_type_idx").on(table.type),
  createdAtIdx: index("ledger_created_at_idx").on(table.createdAt),
  orgIdCreatedAtIdx: index("ledger_org_id_created_at_idx").on(table.orgId, table.createdAt),
}));
