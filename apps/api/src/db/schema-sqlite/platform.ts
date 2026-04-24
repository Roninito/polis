/**
 * SQLite schema — Platform (multi-tenant SaaS)
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable("platform_tenants", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  customDomain: text("custom_domain"),
  status: text("status").notNull().default("active"),
  plan: text("plan").notNull().default("community"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  memberLimit: integer("member_limit"),
  sarPassLimit: integer("sar_pass_limit"),
  apiCallLimit: integer("api_call_limit"),
  metadata: text("metadata", { mode: "json" }).default({}),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const subscriptions = sqliteTable("platform_subscriptions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  stripeSubscriptionId: text("stripe_subscription_id").notNull(),
  plan: text("plan").notNull(),
  status: text("status").notNull(),
  currentPeriodStart: text("current_period_start"),
  currentPeriodEnd: text("current_period_end"),
  cancelledAt: text("cancelled_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const usageEvents = sqliteTable("platform_usage_events", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  eventType: text("event_type").notNull(),
  quantity: integer("quantity").notNull().default(1),
  metadata: text("metadata", { mode: "json" }).default({}),
  occurredAt: text("occurred_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const platformAuditLog = sqliteTable("platform_audit_log", {
  id: text("id").primaryKey(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  details: text("details", { mode: "json" }).default({}),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
