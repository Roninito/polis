/**
 * Core schema — Governance (Constitution, Laws, Proposals, Votes)
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
 * Constitution — one per org, versioned
 */
export const constitutions = pgTable("constitutions", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  version: integer("version").notNull().default(1),
  preamble: text("preamble"),
  ratifiedAt: timestamp("ratified_at", { mode: "string" }),
  ratifiedBy: uuid("ratified_by").references(() => members.id),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  orgIdIdx: index("constitutions_org_id_idx").on(table.orgId),
}));

/**
 * Articles — sections within a constitution
 */
export const articles = pgTable("articles", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  constitutionId: uuid("constitution_id")
    .notNull()
    .references(() => constitutions.id),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  constitutionIdIdx: index("articles_constitution_id_idx").on(table.constitutionId),
}));

/**
 * Laws — operating rules enacted by vote
 */
export const laws = pgTable("laws", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("active"),
  // active | repealed | superseded
  proposalId: uuid("proposal_id").references(() => proposals.id),
  enactedAt: timestamp("enacted_at", { mode: "string" }),
  repealedAt: timestamp("repealed_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  orgIdIdx: index("laws_org_id_idx").on(table.orgId),
  statusIdx: index("laws_status_idx").on(table.status),
  orgIdStatusIdx: index("laws_org_id_status_idx").on(table.orgId, table.status),
}));

/**
 * Proposals — any governance action put to vote
 */
export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  type: text("type").notNull(),
  // ordinance | charter_amendment | resolution | emergency | law | budget
  title: text("title").notNull(),
  body: text("body").notNull(),
  proposedBy: uuid("proposed_by").references(() => members.id),
  status: text("status").notNull().default("draft"),
  // draft | open | voting | passed | failed | withdrawn
  votesFor: integer("votes_for").notNull().default(0),
  votesAgainst: integer("votes_against").notNull().default(0),
  abstain: integer("abstain").notNull().default(0),
  quorumRequired: integer("quorum_required"),
  votingOpens: timestamp("voting_opens", { mode: "string" }),
  votingEnds: timestamp("voting_ends", { mode: "string" }),
  aiAnalysis: jsonb("ai_analysis"),
  metadata: jsonb("metadata").$defaultFn(() => '{}'),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  orgIdIdx: index("proposals_org_id_idx").on(table.orgId),
  statusIdx: index("proposals_status_idx").on(table.status),
  orgIdStatusIdx: index("proposals_org_id_status_idx").on(table.orgId, table.status),
  votingEndsIdx: index("proposals_voting_ends_idx").on(table.votingEnds),
  createdAtIdx: index("proposals_created_at_idx").on(table.createdAt),
}));

/**
 * Votes — individual member votes on proposals
 */
export const votes = pgTable("votes", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  proposalId: uuid("proposal_id")
    .notNull()
    .references(() => proposals.id),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  vote: text("vote").notNull(),
  // yea | nay | abstain
  reason: text("reason"),
  castAt: timestamp("cast_at", { mode: "string" }).notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  // Indexes for common queries
  proposalIdIdx: index("votes_proposal_id_idx").on(table.proposalId),
  memberIdIdx: index("votes_member_id_idx").on(table.memberId),
  proposalMemberIdx: index("votes_proposal_id_member_id_idx").on(table.proposalId, table.memberId),
}));
