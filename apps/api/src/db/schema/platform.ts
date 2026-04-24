/**
 * Platform schema — multi-tenant management (SaaS only)
 *
 * These tables live in the `platform` schema in multi-tenant mode.
 * In standalone mode, they are unused stubs.
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

/**
 * Tenants — registered organizations on the platform
 */
export const tenants = pgTable("platform_tenants", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
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
  metadata: jsonb("metadata").$defaultFn(() => '{}'),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  slugIdx: index("tenants_slug_idx").on(table.slug),
  statusIdx: index("tenants_status_idx").on(table.status),
}));

/**
 * Subscriptions — Stripe subscription tracking
 */
export const subscriptions = pgTable("platform_subscriptions", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  stripeSubscriptionId: text("stripe_subscription_id").notNull(),
  plan: text("plan").notNull(),
  status: text("status").notNull(),
  currentPeriodStart: timestamp("current_period_start", { mode: "string" }),
  currentPeriodEnd: timestamp("current_period_end", { mode: "string" }),
  cancelledAt: timestamp("cancelled_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  tenantIdIdx: index("subscriptions_tenant_id_idx").on(table.tenantId),
  statusIdx: index("subscriptions_status_idx").on(table.status),
}));

/**
 * Usage events — metered billing data
 */
export const usageEvents = pgTable("platform_usage_events", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  eventType: text("event_type").notNull(),
  quantity: integer("quantity").notNull().default(1),
  metadata: jsonb("metadata").$defaultFn(() => '{}'),
  occurredAt: timestamp("occurred_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  tenantIdIdx: index("usage_events_tenant_id_idx").on(table.tenantId),
  eventTypeIdx: index("usage_events_event_type_idx").on(table.eventType),
  occurredAtIdx: index("usage_events_occurred_at_idx").on(table.occurredAt),
}));

/**
 * Platform audit log — immutable record of all platform admin actions
 */
export const platformAuditLog = pgTable("platform_audit_log", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  details: jsonb("details").$defaultFn(() => '{}'),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  actionIdx: index("platform_audit_log_action_idx").on(table.action),
  createdAtIdx: index("platform_audit_log_created_at_idx").on(table.createdAt),
  targetTypeTargetIdIdx: index("platform_audit_log_target_type_id_idx").on(table.targetType, table.targetId),
}));
