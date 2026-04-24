/**
 * SQLite schema — Governance (Constitution, Laws, Proposals, Votes)
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { orgs } from "./orgs";
import { members } from "./members";

export const constitutions = sqliteTable("constitutions", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  version: integer("version").notNull().default(1),
  preamble: text("preamble"),
  ratifiedAt: text("ratified_at"),
  ratifiedBy: text("ratified_by").references(() => members.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const articles = sqliteTable("articles", {
  id: text("id").primaryKey(),
  constitutionId: text("constitution_id").notNull().references(() => constitutions.id),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const laws = sqliteTable("laws", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("active"),
  proposalId: text("proposal_id").references(() => proposals.id),
  enactedAt: text("enacted_at"),
  repealedAt: text("repealed_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const proposals = sqliteTable("proposals", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  proposedBy: text("proposed_by").references(() => members.id),
  status: text("status").notNull().default("draft"),
  votesFor: integer("votes_for").notNull().default(0),
  votesAgainst: integer("votes_against").notNull().default(0),
  abstain: integer("abstain").notNull().default(0),
  quorumRequired: integer("quorum_required"),
  votingOpens: text("voting_opens"),
  votingEnds: text("voting_ends"),
  aiAnalysis: text("ai_analysis", { mode: "json" }),
  metadata: text("metadata", { mode: "json" }).default({}),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const votes = sqliteTable("votes", {
  id: text("id").primaryKey(),
  proposalId: text("proposal_id").notNull().references(() => proposals.id),
  memberId: text("member_id").notNull().references(() => members.id),
  vote: text("vote").notNull(),
  reason: text("reason"),
  castAt: text("cast_at").notNull().$defaultFn(() => new Date().toISOString()),
});
