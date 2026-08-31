import "server-only";

import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { LOCAL_DEMO_SEED_SQL } from "@/demo/local-demo-seed";
import { config } from "@/infrastructure/config/server-config";
import {
  requireDatabaseReadiness,
  requireExistingDatabaseIsCurrent,
} from "@/infrastructure/database/sqlite/server-database-startup";
import type {
  SqliteExecutor,
  SqliteParameter,
} from "@/infrastructure/database/sqlite/sqlite-executor";

let database: DatabaseSync | null = null;

export function initializeDatabase(): DatabaseSync {
  if (database) return database;

  const dataDir = config.database.dataDirectory;
  mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, config.database.filename);
  if (existsSync(dbPath)) requireExistingDatabaseIsCurrent(dbPath);
  const candidate = new DatabaseSync(dbPath);
  candidate.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  const startupExecutor: SqliteExecutor = {
    all: <T>(sql: string, ...params: SqliteParameter[]) =>
      candidate.prepare(sql).all(...params) as T[],
    run: (sql: string, ...params: SqliteParameter[]) => candidate.prepare(sql).run(...params),
  };

  try {
    requireDatabaseReadiness(startupExecutor);
  } catch (error) {
    candidate.close();
    throw error;
  }

  const count = Number((candidate.prepare("SELECT COUNT(*) AS count FROM subjects").get() as { count: number }).count);
  if (count === 0 && config.app.demoDataEnabled) candidate.exec(LOCAL_DEMO_SEED_SQL);
  database = candidate;
  return database;
}

export function all<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return initializeDatabase().prepare(sql).all(...params) as T[];
}

export function get<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return initializeDatabase().prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: SQLInputValue[]) {
  return initializeDatabase().prepare(sql).run(...params);
}
