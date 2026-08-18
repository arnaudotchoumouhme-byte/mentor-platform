import "server-only";

import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { config } from "@/infrastructure/config/server-config";
import { coreMigrationRegistry } from "@/infrastructure/database/sqlite/migrations/definitions/mig-0001-core-baseline";
import { inspectDatabaseFileReadOnly } from "@/infrastructure/database/sqlite/preflight/database-migration-preflight";
import { evaluateRuntimeReadiness } from "./runtime-readiness";

function persistentStorageReady(): boolean {
  if (!config.database.requirePersistentStorage) return true;
  const mountPath = config.database.persistentMountPath;
  if (!mountPath || !existsSync(mountPath)) return false;
  try {
    accessSync(mountPath, constants.R_OK | constants.W_OK);
    const lines = readFileSync("/proc/self/mountinfo", "utf8").split("\n");
    const line = lines.find(item => item.split(" - ")[0]?.split(" ")[4]?.replace(/\\040/g, " ") === mountPath);
    if (!line) return false;
    const fileSystem = line.split(" - ")[1]?.split(" ")[0];
    return !["overlay", "tmpfs", "ramfs"].includes(fileSystem ?? "");
  } catch { return false; }
}

function auth0Configured(): boolean {
  return ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET", "APP_BASE_URL"].every(key => Boolean(process.env[key]?.trim()));
}

export function inspectServerReadiness() {
  const databasePath = path.join(config.database.dataDirectory, config.database.filename);
  const available = existsSync(databasePath);
  const preflight = available ? inspectDatabaseFileReadOnly(databasePath) : null;
  return evaluateRuntimeReadiness({
    persistentStorageReady: persistentStorageReady(),
    databaseAvailable: available && preflight !== null,
    schemaVersion: preflight?.currentVersion ?? null,
    targetVersion: coreMigrationRegistry.currentVersion,
    pendingMigrations: preflight?.pendingMigrations.length ?? coreMigrationRegistry.migrations.length,
    schemaValid: preflight?.status === "NO_MIGRATION" && preflight.integrity === "OK",
    auth0Configured: auth0Configured(),
    aiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
  });
}
