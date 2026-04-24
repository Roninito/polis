/**
 * SQLite schema — SAR Log (AI Audit Trail)
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { orgs } from "./orgs";

export const sarLog = sqliteTable("sar_log", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  task: text("task").notNull(),
  refId: text("ref_id"),
  sense: text("sense").notNull(),
  analyze: text("analyze").notNull(),
  respond: text("respond").notNull(),
  status: text("status").notNull().default("completed"),
  modelUsed: text("model_used"),
  tokensUsed: integer("tokens_used"),
  costCents: integer("cost_cents"),
  metadata: text("metadata", { mode: "json" }).default({}),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
