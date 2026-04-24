/**
 * Database factory — returns the correct Drizzle instance based on config engine.
 *
 * Supports PostgreSQL (via postgres.js) and SQLite (via better-sqlite3).
 * Lazily initialized on first call, then cached.
 */

import type { DatabaseEngine } from "../config/types";

export type DatabaseInstance = {
  db: any;
  engine: DatabaseEngine;
  schema: any;
};

let cached: DatabaseInstance | null = null;

/**
 * Get or create the database instance.
 * If engine/url are provided, uses those. Otherwise reads from config.
 */
export async function getDatabase(
  engine?: DatabaseEngine,
  url?: string
): Promise<DatabaseInstance> {
  if (cached) return cached;

  // Determine engine and URL
  let dbEngine = engine;
  let dbUrl = url;

  if (!dbEngine || !dbUrl) {
    const { loadConfig, isFirstRun } = await import("../config/loader");
    if (await isFirstRun()) {
      // During setup, we don't have a config yet — caller must provide engine/url
      throw new Error("Database not configured. Complete setup first.");
    }
    const config = await loadConfig();
    dbEngine = config.db.engine;
    dbUrl = config.db.url;
  }

  if (dbEngine === "sqlite") {
    cached = await initSQLite(dbUrl!);
  } else {
    cached = await initPostgres(dbUrl!);
  }

  return cached;
}

async function initSQLite(url: string): Promise<DatabaseInstance> {
  const schema = await import("./schema-sqlite");

  // url is file path like ./data/polis.db or :memory:
  let filePath = url.replace(/^sqlite:\/\//, "");

  // Resolve relative paths from project root
  if (filePath !== ":memory:" && !filePath.startsWith("/")) {
    const { getProjectRoot } = await import("../config/loader");
    const { resolve } = await import("path");
    filePath = resolve(getProjectRoot(), filePath);
  }

  // Ensure parent directory exists
  if (filePath !== ":memory:") {
    const { mkdirSync } = await import("fs");
    const { dirname } = await import("path");
    mkdirSync(dirname(filePath), { recursive: true });
  }

  // Try bun:sqlite first (Bun runtime), fall back to better-sqlite3 (Node.js/Vite SSR)
  let db: any;
  try {
    const { Database } = await import("bun:sqlite");
    const { drizzle } = await import("drizzle-orm/bun-sqlite");
    const sqlite = new Database(filePath);
    sqlite.run("PRAGMA journal_mode = WAL");
    sqlite.run("PRAGMA foreign_keys = ON");
    db = drizzle(sqlite, { schema });
    console.log(`[db] SQLite connected (bun:sqlite): ${filePath}`);
  } catch {
    const BetterSqlite3 = (await import("better-sqlite3")).default;
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    const sqlite = new BetterSqlite3(filePath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    db = drizzle(sqlite, { schema });
    console.log(`[db] SQLite connected (better-sqlite3): ${filePath}`);
  }

  return { db, engine: "sqlite", schema };
}

async function initPostgres(url: string): Promise<DatabaseInstance> {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const schema = await import("./schema");

  // Connection pooling configuration for PostgreSQL
  const poolSize = parseInt(process.env.DB_POOL_SIZE || "20");
  const queryClient = postgres(url, {
    max: poolSize,
    idle_timeout: 30,
    connect_timeout: 30,
  });

  const db = drizzle(queryClient, { schema });
  console.log(`[db] PostgreSQL connected with pool size ${poolSize}`);

  return { db, engine: "postgresql", schema };
}

/**
 * Reset cached connection (used after setup completes).
 */
export function resetDatabase(): void {
  cached = null;
}

/**
 * Generate a UUID (works in both engines).
 */
export function generateId(): string {
  return crypto.randomUUID();
}
