/**
 * SAR Log schema — append-only governance AI audit trail
 *
 * No UPDATE or DELETE ever issued on this table.
 * Every SAR engine action produces a log entry before execution.
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

export const sarLog = pgTable("sar_log", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  task: text("task").notNull(),
  refId: text("ref_id"),
  sense: text("sense").notNull(),
  analyze: text("analyze").notNull(),
  respond: text("respond").notNull(),
  status: text("status").notNull().default("completed"),
  modelUsed: text("model_used"),
  tokensUsed: integer("tokens_used"),
  costCents: integer("cost_cents"),
  metadata: jsonb("metadata").$defaultFn(() => '{}'),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  orgIdIdx: index("sar_log_org_id_idx").on(table.orgId),
  taskIdx: index("sar_log_task_idx").on(table.task),
  statusIdx: index("sar_log_status_idx").on(table.status),
  createdAtIdx: index("sar_log_created_at_idx").on(table.createdAt),
  orgIdCreatedAtIdx: index("sar_log_org_id_created_at_idx").on(table.orgId, table.createdAt),
}));
