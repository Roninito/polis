/**
 * Core schema — Organizations
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull().default("general"),
  // general | fraternal | cooperative | municipal | church | trust | enterprise
  description: text("description"),
  logoUrl: text("logo_url"),
  settings: jsonb("settings").$defaultFn(() => '{}'),
  status: text("status").notNull().default("active"),
  // active | suspended | archived
  createdAt: timestamp("created_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  slugIdx: index("orgs_slug_idx").on(table.slug),
  statusIdx: index("orgs_status_idx").on(table.status),
  createdAtIdx: index("orgs_created_at_idx").on(table.createdAt),
}));
