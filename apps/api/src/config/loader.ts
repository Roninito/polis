/**
 * Config loader — reads polis.config.json, resolves env var references.
 *
 * Env references follow the pattern: "env:VAR_NAME"
 * These are resolved at load time to process.env.VAR_NAME.
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import type { PolisConfig } from "./types";

/**
 * Find the monorepo root by walking up looking for a package.json with workspaces.
 */
function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.workspaces || pkg.name === "polis") return dir;
      } catch {}
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
const CONFIG_PATH = join(PROJECT_ROOT, "polis.config.json");

/**
 * Resolve "env:VAR_NAME" references to actual environment variable values.
 */
function resolveEnvRefs<T>(obj: T): T {
  if (typeof obj === "string" && obj.startsWith("env:")) {
    const envKey = obj.slice(4);
    const value = process.env[envKey];
    if (!value) {
      console.warn(`[config] Environment variable ${envKey} is not set`);
    }
    return (value ?? "") as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(resolveEnvRefs) as unknown as T;
  }

  if (obj && typeof obj === "object") {
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      resolved[key] = resolveEnvRefs(val);
    }
    return resolved as T;
  }

  return obj;
}

let cachedConfig: PolisConfig | null = null;

/**
 * Check if this is the first run (no config file exists).
 */
export async function isFirstRun(): Promise<boolean> {
  return !existsSync(CONFIG_PATH);
}

/**
 * Load and cache the POLIS config. Resolves env var references.
 * Throws if config file doesn't exist.
 */
export async function loadConfig(): Promise<PolisConfig> {
  if (cachedConfig) return cachedConfig;

  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      "polis.config.json not found. Run the setup wizard first."
    );
  }

  const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  cachedConfig = resolveEnvRefs(raw) as PolisConfig;
  return cachedConfig;
}

/**
 * Get config path (used by setup wizard to write the file).
 */
export function getConfigPath(): string {
  return CONFIG_PATH;
}

/**
 * Get project root directory.
 */
export function getProjectRoot(): string {
  return PROJECT_ROOT;
}
