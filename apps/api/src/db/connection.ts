/**
 * Database connection — lazy init via factory.
 *
 * Supports both PostgreSQL and SQLite based on polis.config.json.
 * Exports a `db` that gets initialized on first use.
 */

import { getDatabase, type DatabaseInstance } from "./factory";

let instance: DatabaseInstance | null = null;
let _db: any = null;

/**
 * Initialize the database connection. Must be called after setup completes.
 */
export async function initDb(): Promise<void> {
  if (_db) return;
  instance = await getDatabase();
  _db = instance.db;
}

/**
 * Get the Drizzle database instance.
 * Throws if not initialized (initDb not called or setup not complete).
 */
export const db = new Proxy({} as any, {
  get(_target, prop) {
    if (!_db) throw new Error("Database not initialized. Call initDb() first.");
    return (_db as any)[prop];
  },
});

export function getDbEngine(): string {
  return instance?.engine ?? "unknown";
}

export type Database = any;
