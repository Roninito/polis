/**
 * Demo seed script — populates database with rich sample data for showcase.
 *
 * Creates multiple organizations with realistic governance scenarios.
 * Run: bun run db:seed-demo
 */

import { db } from "./connection";
import {
  orgs, users, members, constitutions, articles,
  proposals, treasuries, sarLog,
} from "./schema";

async function seedDemo() {
  console.log("[seed-demo] Starting comprehensive demo seed...");

  // Create admin user
  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@polis.app",
      passwordHash: await Bun.password.hash("admin123", { algorithm: "bcrypt", cost: 12 }),
      name: "Platform Admin",
      role: "superadmin",
    })
    .returning();
  console.log(`[seed-demo] Admin: ${admin.email}`);

  // Create demo user accounts
  const demoUsers = await db
    .insert(users)
    .values([
      { email: "marcus@maplewood.gov", passwordHash: await Bun.password.hash("demo1234", { algorithm: "bcrypt", cost: 12 }), name: "Marcus Washington" },
      { email: "linda@maplewood.gov", passwordHash: await Bun.password.hash("demo1234", { algorithm: "bcrypt", cost: 12 }), name: "Linda Chen" },
      { email: "james@maplewood.gov", passwordHash: await Bun.password.hash("demo1234", { algorithm: "bcrypt", cost: 12 }), name: "James Rivera" },
      { email: "sarah@maplewood.gov", passwordHash: await Bun.password.hash("demo1234", { algorithm: "bcrypt", cost: 12 }), name: "Sarah Okafor" },
      { email: "david@community.org", passwordHash: await Bun.password.hash("demo1234", { algorithm: "bcrypt", cost: 12 }), name: "David Kim" },
    ])
    .returning();

  // ── Org 1: Town of Maplewood ──
  const [maplewood] = await db
    .insert(orgs)
    .values({
      name: "Town of Maplewood",
      slug: "maplewood",
      type: "municipal",
      description: "A small town using POLIS for transparent governance and community decision-making.",
    })
    .returning();

  const mapleMembers = await db
    .insert(members)
    .values([
      { orgId: maplewood.id, userId: demoUsers[0].id, name: "Marcus Washington", email: "marcus@maplewood.gov", role: "founder" },
      { orgId: maplewood.id, userId: demoUsers[1].id, name: "Linda Chen", email: "linda@maplewood.gov", role: "admin" },
      { orgId: maplewood.id, userId: demoUsers[2].id, name: "James Rivera", email: "james@maplewood.gov", role: "council" },
      { orgId: maplewood.id, userId: demoUsers[3].id, name: "Sarah Okafor", email: "sarah@maplewood.gov", role: "council" },
      { orgId: maplewood.id, name: "Emma Thompson", email: "emma@maplewood.gov", role: "member" },
      { orgId: maplewood.id, name: "Robert Garcia", email: "robert@maplewood.gov", role: "member" },
      { orgId: maplewood.id, name: "Maria Santos", email: "maria@maplewood.gov", role: "member" },
    ])
    .returning();

  const [mapleConstitution] = await db
    .insert(constitutions)
    .values({
      orgId: maplewood.id,
      version: 1,
      preamble: "We, the residents of Maplewood, establish this governance framework to ensure transparent, democratic, and accountable administration of our community resources and shared spaces.",
      ratifiedBy: mapleMembers[0].id,
      ratifiedAt: new Date(),
    })
    .returning();

  await db.insert(articles).values([
    { constitutionId: mapleConstitution.id, number: 1, title: "Governance Structure", body: "The Town shall be governed by an elected Council with decisions made through transparent voting processes monitored by the SAR engine." },
    { constitutionId: mapleConstitution.id, number: 2, title: "Treasury Management", body: "All financial transactions shall be recorded in an immutable ledger. No funds may be disbursed without ratified member vote. A minimum reserve of 15% shall be maintained." },
    { constitutionId: mapleConstitution.id, number: 3, title: "Voting Rights", body: "Every active member has one vote per proposal. Voting periods shall be no less than 48 hours. Simple majority constitutes passage." },
    { constitutionId: mapleConstitution.id, number: 4, title: "Emergency Procedures", body: "Emergency proposals require 2/3 supermajority within 24 hours. Only Council members may declare an emergency." },
  ]);

  await db.insert(proposals).values([
    {
      orgId: maplewood.id, type: "ordinance",
      title: "Community Garden Expansion — Phase II",
      body: "Allocate $12,000 from the community development fund to expand the garden on Elm Street by 50%. Includes raised beds, drip irrigation, and a tool shed.",
      proposedBy: mapleMembers[2].id, status: "voting", votesFor: 4, votesAgainst: 1, abstain: 0,
      votingEnds: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
    {
      orgId: maplewood.id, type: "resolution",
      title: "Annual Budget Approval FY2026",
      body: "Approve the proposed annual budget of $125,000 for fiscal year 2026, allocating funds across infrastructure, community programs, and reserve contributions.",
      proposedBy: mapleMembers[1].id, status: "passed", votesFor: 6, votesAgainst: 0, abstain: 1,
    },
    {
      orgId: maplewood.id, type: "ordinance",
      title: "Street Light Replacement Program",
      body: "Replace 30 aging sodium-vapor street lights with LED fixtures. Estimated cost: $8,500. Expected energy savings: 60%.",
      proposedBy: mapleMembers[3].id, status: "draft", votesFor: 0, votesAgainst: 0, abstain: 0,
    },
  ]);

  await db.insert(treasuries).values({
    orgId: maplewood.id,
    balance: 4725000, reserveBalance: 1000000, poolBalance: 3725000,
    cycleNumber: 3,
  });

  // SAR log entries
  await db.insert(sarLog).values([
    {
      orgId: maplewood.id, task: "proposal_intake", refId: "ORD-2026-001",
      sense: "New proposal submitted: Community Garden Expansion Phase II requesting $12,000 from development fund.",
      analyze: "Proposal is constitutionally compliant. Budget impact: 3.2% of available pool. Historical precedent: Phase I completed under budget. Risk: LOW. No conflicts with existing laws detected.",
      respond: "Recommendation: APPROVE for voting. Suggested voting period: 7 days. Quorum requirement: simple majority (4 of 7 members).",
      status: "completed", modelUsed: "claude-sonnet-4-20250514", tokensUsed: 1247,
    },
    {
      orgId: maplewood.id, task: "cycle_monitoring",
      sense: "Routine cycle check for Maplewood — Cycle #3, Day 15 of 30.",
      analyze: "All systems nominal. 1 proposal in active voting (2 days remaining). Treasury reserve at 21.2% (above 15% minimum). No overdue items. 7/7 members active.",
      respond: "No action required. Next scheduled check: Cycle #3, Day 22.",
      status: "completed", modelUsed: "claude-3-haiku-20240307", tokensUsed: 523,
    },
    {
      orgId: maplewood.id, task: "ledger_audit",
      sense: "Monthly ledger audit triggered for March 2026.",
      analyze: "All 12 transactions verified. HMAC signatures valid. Running balance consistent. No anomalies detected. Reserve ratio maintained above threshold.",
      respond: "Audit PASSED. Ledger integrity confirmed. No discrepancies found.",
      status: "completed", modelUsed: "claude-sonnet-4-20250514", tokensUsed: 891,
    },
  ]);

  console.log(`[seed-demo] Created Town of Maplewood (${mapleMembers.length} members, 3 proposals, 3 SAR entries)`);

  // ── Org 2: Oakwood Family Trust ──
  const [oakwood] = await db
    .insert(orgs)
    .values({
      name: "Oakwood Family Trust",
      slug: "oakwood-trust",
      type: "family_trust",
      description: "Multi-generational family trust managing shared assets and inheritance planning.",
    })
    .returning();

  await db.insert(members).values([
    { orgId: oakwood.id, userId: demoUsers[4].id, name: "David Kim", email: "david@community.org", role: "founder" },
    { orgId: oakwood.id, name: "Jennifer Kim", email: "jennifer@family.net", role: "admin" },
    { orgId: oakwood.id, name: "Michael Kim", email: "michael@family.net", role: "member" },
    { orgId: oakwood.id, name: "Grace Kim", email: "grace@family.net", role: "member" },
  ]);

  await db.insert(treasuries).values({
    orgId: oakwood.id,
    balance: 15000000, reserveBalance: 5000000, poolBalance: 10000000,
    currency: "USD", cycleNumber: 1,
  });

  console.log("[seed-demo] Created Oakwood Family Trust");

  console.log("[seed-demo] ✅ Demo seed complete!");
  process.exit(0);
}

seedDemo().catch((err) => {
  console.error("[seed-demo] Error:", err);
  process.exit(1);
});
