/**
 * Setup wizard API routes.
 * These only work when polis.config.json doesn't exist (first run).
 */

import { writeFileSync } from "fs";
import { resolve } from "path";
import { Errors } from "../../lib/errors";
import { ok, created } from "../../lib/response";
import type { PolisConfig, DeploymentMode, ProviderType, DatabaseEngine } from "../../config/types";
import { generateId } from "../../db/factory";
import { getProjectRoot } from "../../config/loader";

/**
 * Open a SQLite database using bun:sqlite or better-sqlite3.
 * Returns a unified interface.
 */
async function openSqlite(filePath: string) {
  try {
    const { Database } = await import("bun:sqlite");
    const db = new Database(filePath);
    return {
      run: (sql: string) => db.run(sql),
      exec: (sql: string) => db.exec(sql),
      query: (sql: string) => ({ get: () => db.query(sql).get() }),
      prepare: (sql: string) => db.prepare(sql),
      close: () => db.close(),
      pragma: (p: string) => db.run(`PRAGMA ${p}`),
    };
  } catch {
    const BetterSqlite3 = (await import("better-sqlite3")).default;
    const db = new BetterSqlite3(filePath);
    return {
      run: (sql: string) => db.exec(sql),
      exec: (sql: string) => db.exec(sql),
      query: (sql: string) => ({ get: () => db.prepare(sql).get() }),
      prepare: (sql: string) => db.prepare(sql),
      close: () => db.close(),
      pragma: (p: string) => db.pragma(p),
    };
  }
}

/**
 * Resolve a SQLite file path relative to the project root.
 */
function resolveSqlitePath(url: string): string {
  const filePath = url.replace(/^sqlite:\/\//, "");
  if (filePath === ":memory:" || filePath.startsWith("/")) return filePath;
  return resolve(getProjectRoot(), filePath);
}

/**
 * POST /setup/detect-db — Auto-detect available database engines
 */
export async function detectDb(_req: Request): Promise<Response> {
  const results: {
    postgresql: { available: boolean; connectionUrl?: string; databases?: string[]; error?: string };
    sqlite: { available: boolean };
  } = {
    postgresql: { available: false },
    sqlite: { available: true },
  };

  // Try common PostgreSQL connection strings
  const candidates = [
    `postgresql://${process.env.USER ?? "postgres"}@localhost:5432/postgres`,
    "postgresql://postgres@localhost:5432/postgres",
    "postgresql://postgres:postgres@localhost:5432/postgres",
    "postgresql://localhost:5432/postgres",
  ];

  for (const url of candidates) {
    try {
      const { default: postgres } = await import("postgres");
      const sql = postgres(url, { max: 1, connect_timeout: 3, idle_timeout: 1 });
      await sql`SELECT 1`;

      // Get list of databases
      const dbs = await sql`SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`;
      await sql.end();

      results.postgresql = {
        available: true,
        connectionUrl: url,
        databases: dbs.map((d: any) => d.datname),
      };
      break;
    } catch {
      continue;
    }
  }

  return ok(results);
}

/**
 * POST /setup/create-db — Create the polis database (and optionally user)
 */
export async function createDb(req: Request): Promise<Response> {
  const { superuserUrl, dbName, dbUser, dbPassword } = await req.json() as {
    superuserUrl: string;
    dbName?: string;
    dbUser?: string;
    dbPassword?: string;
  };

  if (!superuserUrl) throw Errors.validation("Superuser connection URL is required");

  const name = dbName ?? "polis";
  const user = dbUser ?? "polis";
  const pass = dbPassword ?? "polis";

  try {
    const { default: postgres } = await import("postgres");
    const sql = postgres(superuserUrl, { max: 1, connect_timeout: 5 });

    // Create user if it doesn't exist
    const existingUsers = await sql`SELECT 1 FROM pg_roles WHERE rolname = ${user}`;
    if (existingUsers.length === 0) {
      await sql.unsafe(`CREATE USER "${user}" WITH PASSWORD '${pass.replace(/'/g, "''")}'`);
    }

    // Create database if it doesn't exist
    const existingDbs = await sql`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (existingDbs.length === 0) {
      await sql.unsafe(`CREATE DATABASE "${name}" OWNER "${user}"`);
    } else {
      // Ensure ownership
      await sql.unsafe(`ALTER DATABASE "${name}" OWNER TO "${user}"`);
    }

    // Grant privileges
    await sql.unsafe(`GRANT ALL PRIVILEGES ON DATABASE "${name}" TO "${user}"`);
    await sql.end();

    // Build the connection URL for the new database
    const superUrl = new URL(superuserUrl.replace("postgresql://", "http://"));
    const connectionUrl = `postgresql://${user}:${pass}@${superUrl.hostname}:${superUrl.port || 5432}/${name}`;

    return ok({
      success: true,
      connectionUrl,
      dbName: name,
      dbUser: user,
    });
  } catch (e: any) {
    return ok({ success: false, error: e.message });
  }
}

/**
 * POST /setup/test-db — Test database connection (PostgreSQL or SQLite)
 */
export async function testDb(req: Request): Promise<Response> {
  const { engine, url } = await req.json() as { engine?: DatabaseEngine; url: string };
  if (!url) throw Errors.validation("Database URL or path is required");

  const dbEngine = engine ?? "postgresql";

  try {
    if (dbEngine === "sqlite") {
      const { mkdirSync } = await import("fs");
      const { dirname } = await import("path");

      const filePath = resolveSqlitePath(url);
      if (filePath !== ":memory:") {
        mkdirSync(dirname(filePath), { recursive: true });
      }

      const db = await openSqlite(filePath);
      db.pragma("journal_mode = WAL");
      const result = db.query("SELECT 1 as ok").get() as any;
      db.close();

      return ok({ success: result?.ok === 1, version: "SQLite" });
    } else {
      const { default: postgres } = await import("postgres");
      const sql = postgres(url, { max: 1, connect_timeout: 5, idle_timeout: 2 });
      await sql`SELECT 1 as ok`;
      await sql.end();
      return ok({ success: true, version: "PostgreSQL" });
    }
  } catch (e: any) {
    return ok({ success: false, error: e.message });
  }
}

/**
 * POST /setup/test-ai — Test AI provider connection
 */
export async function testAi(req: Request): Promise<Response> {
  const body = await req.json() as {
    provider: string;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  };

  if (!body.provider) {
    throw Errors.validation("Provider is required");
  }

  // Ollama doesn't need an API key
  if (body.provider !== "ollama" && !body.apiKey) {
    throw Errors.validation("API key is required for this provider");
  }

  try {
    let testUrl: string;
    const headers: Record<string, string> = {};

    switch (body.provider) {
      case "anthropic":
        testUrl = "https://api.anthropic.com/v1/messages";
        headers["x-api-key"] = body.apiKey;
        headers["anthropic-version"] = "2023-06-01";
        headers["content-type"] = "application/json";
        // Minimal request to test auth
        const anthropicRes = await fetch(testUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: body.model ?? "claude-sonnet-4-20250514",
            max_tokens: 5,
            messages: [{ role: "user", content: "Hello" }],
          }),
        });
        if (!anthropicRes.ok && anthropicRes.status === 401) {
          return ok({ success: false, error: "Invalid API key" });
        }
        return ok({ success: true, provider: "anthropic" });

      case "openai":
        testUrl = "https://api.openai.com/v1/models";
        headers["Authorization"] = `Bearer ${body.apiKey}`;
        const oaiRes = await fetch(testUrl, { headers });
        if (!oaiRes.ok) {
          return ok({ success: false, error: "Invalid API key" });
        }
        return ok({ success: true, provider: "openai" });

      case "ollama":
        testUrl = body.baseUrl ?? "http://localhost:11434";
        const ollamaRes = await fetch(`${testUrl}/api/tags`);
        if (!ollamaRes.ok) {
          return ok({ success: false, error: "Ollama not reachable" });
        }
        const ollamaData = await ollamaRes.json() as { models?: any[] };
        return ok({ success: true, provider: "ollama", models: ollamaData.models?.length ?? 0 });

      default:
        if (body.baseUrl) {
          // Custom OpenAI-compatible endpoint
          testUrl = `${body.baseUrl}/v1/models`;
          headers["Authorization"] = `Bearer ${body.apiKey}`;
          const customRes = await fetch(testUrl, { headers });
          return ok({ success: customRes.ok, provider: "custom" });
        }
        return ok({ success: false, error: `Unknown provider: ${body.provider}` });
    }
  } catch (e: any) {
    return ok({ success: false, error: e.message });
  }
}

/**
 * POST /setup/complete — Finalize setup, write config, create admin
 */
export async function completeSetup(req: Request): Promise<Response> {
  const body = await req.json() as {
    deploymentMode: "standalone" | "multi-tenant";
    database: { engine?: DatabaseEngine; url: string };
    ai: {
      provider: string;
      apiKey: string;
      model?: string;
      baseUrl?: string;
    };
    admin: {
      name: string;
      email: string;
      password: string;
    };
    org: {
      name: string;
      type: string;
      slug?: string;
    };
  };

  // Validate required fields
  if (!body.deploymentMode) throw Errors.validation("Deployment mode is required");
  if (!body.database?.url) throw Errors.validation("Database URL or path is required");
  if (!body.ai?.provider) throw Errors.validation("AI provider is required");
  if (body.ai.provider !== "ollama" && !body.ai.apiKey) throw Errors.validation("AI API key is required (except for Ollama)");
  if (!body.admin?.email || !body.admin?.password) throw Errors.validation("Admin account is required");
  if (!body.org?.name) throw Errors.validation("Organization name is required");

  const dbEngine: DatabaseEngine = body.database.engine ?? "postgresql";
  const deploymentMode = body.deploymentMode === "multi-tenant" ? "multitenant" : "standalone";

  // Build polis.config.json
  const config: PolisConfig = {
    deploymentMode: deploymentMode as DeploymentMode,
    setupComplete: true,
    setupDate: new Date().toISOString(),
    db: {
      engine: dbEngine,
      url: body.database.url,
    },
    ai: {
      provider: body.ai.provider as ProviderType,
      model: body.ai.model ?? "auto",
      apiKeyRef: body.ai.apiKey,
      apiKey: body.ai.apiKey,
      baseUrl: body.ai.baseUrl,
    },
    platform: deploymentMode === "multitenant" ? {
      domain: "localhost",
      stripeKeyRef: "",
      emailProvider: "resend" as const,
    } : undefined,
  };

  // Write config file
  const { getConfigPath } = await import("../../config/loader");
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  // Set up database — create tables and seed initial data
  try {
    const { hashPassword } = await import("../../auth/passwords");
    const passwordHash = await hashPassword(body.admin.password);
    const orgSlug = body.org.slug ?? body.org.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    if (dbEngine === "sqlite") {
      await bootstrapSQLite(body.database.url, {
        admin: { ...body.admin, passwordHash },
        org: { ...body.org, slug: orgSlug },
      });
    } else {
      await bootstrapPostgres(body.database.url, {
        admin: { ...body.admin, passwordHash },
        org: { ...body.org, slug: orgSlug },
      });
    }
  } catch (e: any) {
    // Clean up config if DB setup fails
    const { unlink } = await import("node:fs/promises");
    try { await unlink(configPath); } catch {}
    throw Errors.internal(`Database setup failed: ${e.message}`);
  }

  // Re-initialize the server with the new config (no restart needed)
  try {
    const { reinitAfterSetup } = await import("../../handler");
    await reinitAfterSetup();
  } catch (e: any) {
    console.error("[setup] Post-setup reinit warning:", e.message);
  }

  return created({
    success: true,
    message: "Setup complete! Redirecting to login...",
  });
}

interface BootstrapData {
  admin: { name: string; email: string; passwordHash: string };
  org: { name: string; type: string; slug: string };
}

async function bootstrapSQLite(url: string, data: BootstrapData) {
  const { mkdirSync } = await import("fs");
  const { dirname } = await import("path");

  const filePath = resolveSqlitePath(url);
  if (filePath !== ":memory:") {
    mkdirSync(dirname(filePath), { recursive: true });
  }

  const db = await openSqlite(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS orgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL DEFAULT 'cooperative',
      description TEXT,
      logo_url TEXT,
      settings TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      totp_secret TEXT,
      totp_enabled INTEGER DEFAULT 0,
      backup_codes TEXT,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'active',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      rotation_pos INTEGER,
      has_received INTEGER DEFAULT 0,
      metadata TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS treasuries (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      balance INTEGER NOT NULL DEFAULT 0,
      reserve_balance INTEGER NOT NULL DEFAULT 0,
      pool_balance INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      cycle_number INTEGER NOT NULL DEFAULT 0,
      cycle_started_at TEXT,
      next_payout_at TEXT,
      settings TEXT DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      name TEXT NOT NULL,
      prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      scopes TEXT DEFAULT '[]',
      last_used_at TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS constitutions (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      version INTEGER NOT NULL DEFAULT 1,
      preamble TEXT,
      ratified_at TEXT,
      ratified_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      constitution_id TEXT NOT NULL REFERENCES constitutions(id),
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS laws (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      proposal_id TEXT,
      enacted_at TEXT,
      repealed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      proposed_by TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      votes_for INTEGER NOT NULL DEFAULT 0,
      votes_against INTEGER NOT NULL DEFAULT 0,
      abstain INTEGER NOT NULL DEFAULT 0,
      quorum_required INTEGER,
      voting_opens TEXT,
      voting_ends TEXT,
      ai_analysis TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL REFERENCES proposals(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      vote TEXT NOT NULL,
      reason TEXT,
      cast_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS ledger (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      type TEXT NOT NULL,
      member_id TEXT,
      amount INTEGER NOT NULL,
      balance INTEGER NOT NULL,
      note TEXT,
      hmac TEXT NOT NULL,
      cycle_ref INTEGER,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sar_log (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      task TEXT NOT NULL,
      ref_id TEXT,
      sense TEXT NOT NULL,
      analyze TEXT NOT NULL,
      respond TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      model_used TEXT,
      tokens_used INTEGER,
      cost_cents INTEGER,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const orgId = generateId();
  const userId = generateId();
  const memberId = generateId();
  const treasuryId = generateId();

  db.prepare("INSERT INTO orgs (id, name, slug, type) VALUES (?, ?, ?, ?)").run(
    orgId, data.org.name, data.org.slug, data.org.type ?? "cooperative"
  );
  db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)").run(
    userId, data.admin.email, data.admin.passwordHash, data.admin.name
  );
  db.prepare("INSERT INTO members (id, org_id, user_id, name, email, role) VALUES (?, ?, ?, ?, ?, ?)").run(
    memberId, orgId, userId, data.admin.name, data.admin.email, "admin"
  );
  db.prepare("INSERT INTO treasuries (id, org_id) VALUES (?, ?)").run(
    treasuryId, orgId
  );

  db.close();
}

async function bootstrapPostgres(url: string, data: BootstrapData) {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url);

  await sql`
    CREATE TABLE IF NOT EXISTS orgs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL DEFAULT 'cooperative',
      description TEXT,
      logo_url TEXT,
      settings JSONB DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      totp_secret TEXT,
      totp_enabled BOOLEAN DEFAULT false,
      backup_codes JSONB,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'active',
      joined_at TIMESTAMPTZ DEFAULT now(),
      rotation_pos INTEGER,
      has_received BOOLEAN DEFAULT false,
      metadata JSONB DEFAULT '{}'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS treasuries (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      balance INTEGER NOT NULL DEFAULT 0,
      reserve_balance INTEGER NOT NULL DEFAULT 0,
      pool_balance INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      cycle_number INTEGER NOT NULL DEFAULT 0,
      cycle_started_at TIMESTAMPTZ,
      next_payout_at TIMESTAMPTZ,
      settings JSONB DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS constitutions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      version INTEGER NOT NULL DEFAULT 1,
      preamble TEXT,
      ratified_at TIMESTAMPTZ,
      ratified_by TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      proposed_by TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      votes_for INTEGER NOT NULL DEFAULT 0,
      votes_against INTEGER NOT NULL DEFAULT 0,
      abstain INTEGER NOT NULL DEFAULT 0,
      quorum_required INTEGER,
      voting_opens TIMESTAMPTZ,
      voting_ends TIMESTAMPTZ,
      ai_analysis JSONB,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS laws (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      proposal_id TEXT REFERENCES proposals(id),
      enacted_at TIMESTAMPTZ,
      repealed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      proposal_id TEXT NOT NULL REFERENCES proposals(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      vote TEXT NOT NULL,
      reason TEXT,
      cast_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ledger (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      type TEXT NOT NULL,
      member_id TEXT,
      amount INTEGER NOT NULL,
      balance INTEGER NOT NULL,
      note TEXT,
      hmac TEXT NOT NULL,
      cycle_ref INTEGER,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sar_log (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      task TEXT NOT NULL,
      ref_id TEXT,
      sense TEXT NOT NULL,
      analyze TEXT NOT NULL,
      respond TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      model_used TEXT,
      tokens_used INTEGER,
      cost_cents INTEGER,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  const [user] = await sql`
    INSERT INTO users (email, password_hash, name)
    VALUES (${data.admin.email}, ${data.admin.passwordHash}, ${data.admin.name})
    RETURNING id
  `;

  const [org] = await sql`
    INSERT INTO orgs (name, slug, type)
    VALUES (${data.org.name}, ${data.org.slug}, ${data.org.type ?? "cooperative"})
    RETURNING id
  `;

  await sql`
    INSERT INTO members (org_id, user_id, name, email, role)
    VALUES (${org.id}, ${user.id}, ${data.admin.name}, ${data.admin.email}, 'admin')
  `;

  await sql`INSERT INTO treasuries (org_id) VALUES (${org.id})`;

  await sql.end();
}
