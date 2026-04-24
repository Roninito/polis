/**
 * Generate and run Drizzle migrations.
 *
 * Usage:
 *   bun run apps/api/src/db/migrate.ts generate  — generate SQL from schema
 *   bun run apps/api/src/db/migrate.ts push       — push schema to database
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://polis:polis@localhost:5432/polis";

async function runMigrations() {
  const command = process.argv[2];

  if (command === "push") {
    console.log("[migrate] Pushing schema to database...");
    const sql = postgres(DATABASE_URL, { max: 1 });
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: "./drizzle" });
    await sql.end();
    console.log("[migrate] Migrations applied successfully.");
  } else {
    console.log("Usage:");
    console.log("  bun run apps/api/src/db/migrate.ts push   — run pending migrations");
    console.log("  bun drizzle-kit generate                  — generate migration SQL from schema diff");
    console.log("  bun drizzle-kit push                      — push schema directly to database");
  }

  process.exit(0);
}

runMigrations().catch((err) => {
  console.error("[migrate] Error:", err);
  process.exit(1);
});
