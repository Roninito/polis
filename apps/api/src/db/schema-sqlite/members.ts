/**
 * SQLite schema — Members, Users, API Keys, Refresh Tokens
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"),
  totpSecret: text("totp_secret"),
  totpEnabled: integer("totp_enabled", { mode: "boolean" }).default(false),
  backupCodes: text("backup_codes", { mode: "json" }),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  userId: text("user_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("active"),
  joinedAt: text("joined_at").notNull().$defaultFn(() => new Date().toISOString()),
  rotationPos: integer("rotation_pos"),
  hasReceived: integer("has_received", { mode: "boolean" }).default(false),
  metadata: text("metadata", { mode: "json" }).default({}),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  scopes: text("scopes", { mode: "json" }).default([]),
  lastUsedAt: text("last_used_at"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Import after declaration to avoid circular reference
import { orgs } from "./orgs";
