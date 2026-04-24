/**
 * Dev seed script — populates database with sample data.
 * Run: bun run db:seed
 */

import { db } from "./connection";
import { orgs, users, members, constitutions, articles, proposals, treasuries } from "./schema";

async function seed() {
  console.log("[seed] Starting...");

  // Create superadmin user
  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@polis.app",
      // bcrypt hash of "admin123" — for dev only
      passwordHash: "$2b$12$LJ3m4JTbKJjZa9lN3qXuZeQ4CgJ5K7V8Z9nR2pA1xD6wE8yF0gH2i",
      name: "Platform Admin",
      role: "superadmin",
    })
    .returning();

  console.log(`[seed] Created admin user: ${admin.email}`);

  // Create sample org — Town of Maplewood
  const [org] = await db
    .insert(orgs)
    .values({
      name: "Town of Maplewood",
      slug: "maplewood",
      type: "municipal",
      description: "A small town governance using POLIS for transparent decision-making.",
    })
    .returning();

  console.log(`[seed] Created org: ${org.name}`);

  // Create members
  const memberData = [
    { name: "Marcus Washington", email: "marcus@maplewood.gov", role: "founder" },
    { name: "Linda Chen", email: "linda@maplewood.gov", role: "admin" },
    { name: "James Rivera", email: "james@maplewood.gov", role: "council" },
    { name: "Sarah Okafor", email: "sarah@maplewood.gov", role: "council" },
    { name: "David Kim", email: "david@maplewood.gov", role: "member" },
    { name: "Emma Thompson", email: "emma@maplewood.gov", role: "member" },
    { name: "Robert Garcia", email: "robert@maplewood.gov", role: "member" },
  ];

  const insertedMembers = await db
    .insert(members)
    .values(memberData.map((m) => ({ ...m, orgId: org.id })))
    .returning();

  console.log(`[seed] Created ${insertedMembers.length} members`);

  // Create constitution
  const [constitution] = await db
    .insert(constitutions)
    .values({
      orgId: org.id,
      version: 1,
      preamble:
        "We, the residents of Maplewood, establish this governance framework to ensure transparent, democratic, and accountable administration of our community.",
      ratifiedBy: insertedMembers[0].id,
      ratifiedAt: new Date(),
    })
    .returning();

  // Create articles
  await db.insert(articles).values([
    {
      constitutionId: constitution.id,
      number: 1,
      title: "Governance Structure",
      body: "The Town of Maplewood shall be governed by a Council of elected members, with decisions made through transparent voting processes monitored by the SAR engine.",
    },
    {
      constitutionId: constitution.id,
      number: 2,
      title: "Treasury Management",
      body: "All financial transactions shall be recorded in an immutable ledger. No funds may be disbursed without a ratified member vote. The SAR engine prepares disbursements but never executes them.",
    },
    {
      constitutionId: constitution.id,
      number: 3,
      title: "Voting Rights",
      body: "Every active member in good standing has one vote per proposal. Voting periods shall be no less than 48 hours. A simple majority constitutes passage unless otherwise specified.",
    },
  ]);

  console.log("[seed] Created constitution with 3 articles");

  // Create sample proposal
  await db.insert(proposals).values({
    orgId: org.id,
    type: "ordinance",
    title: "Community Garden Expansion — Phase II",
    body: "Proposal to allocate $12,000 from the community development fund to expand the community garden on Elm Street by 50%. Includes raised beds, irrigation, and a tool shed.",
    proposedBy: insertedMembers[2].id,
    status: "voting",
    votesFor: 4,
    votesAgainst: 1,
    abstain: 0,
    votingEnds: new Date(Date.now() + 48 * 60 * 60 * 1000),
  });

  console.log("[seed] Created sample proposal");

  // Create treasury
  await db.insert(treasuries).values({
    orgId: org.id,
    balance: 4725000, // $47,250.00
    reserveBalance: 1000000, // $10,000.00
    poolBalance: 3725000, // $37,250.00
    cycleNumber: 1,
  });

  console.log("[seed] Created treasury");
  console.log("[seed] Done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] Error:", err);
  process.exit(1);
});
