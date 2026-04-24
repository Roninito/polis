/**
 * Core schema — Members
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { orgs } from "./orgs";

export const members = pgTable("members", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  userId: uuid("user_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("member"),
  // founder | admin | council | member | observer
  status: text("status").notNull().default("active"),
  // active | late | suspended | left
  joinedAt: timestamp("joined_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
  rotationPos: integer("rotation_pos"),
  hasReceived: boolean("has_received").$defaultFn(() => 0 as any),
  metadata: jsonb("metadata").$defaultFn(() => '{}'),
}, (table) => ({
  // Indexes for common queries
  orgIdIdx: index("members_org_id_idx").on(table.orgId),
  userIdIdx: index("members_user_id_idx").on(table.userId),
  statusIdx: index("members_status_idx").on(table.status),
  orgIdStatusIdx: index("members_org_id_status_idx").on(table.orgId, table.status),
  createdAtIdx: index("members_created_at_idx").on(table.joinedAt),
}));

/**
 * Users — authentication identities (separate from org membership)
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"),
  // superadmin | user
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").$defaultFn(() => 0 as any),
  backupCodes: jsonb("backup_codes"),
  lastLoginAt: timestamp("last_login_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  emailIdx: index("users_email_idx").on(table.email),
  createdAtIdx: index("users_created_at_idx").on(table.createdAt),
}));

/**
 * API Keys — org-scoped, SHA-256 hashed at rest
 */
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  scopes: jsonb("scopes").$defaultFn(() => '[]'),
  lastUsedAt: timestamp("last_used_at", { mode: "string" }),
  expiresAt: timestamp("expires_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  orgIdIdx: index("api_keys_org_id_idx").on(table.orgId),
  prefixIdx: index("api_keys_prefix_idx").on(table.prefix),
}));

/**
 * Refresh tokens for JWT auth
 */
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: uuid("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  userIdIdx: index("refresh_tokens_user_id_idx").on(table.userId),
  expiresAtIdx: index("refresh_tokens_expires_at_idx").on(table.expiresAt),
}));
