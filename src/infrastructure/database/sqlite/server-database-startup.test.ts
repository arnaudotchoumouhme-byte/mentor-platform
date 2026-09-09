import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SqliteExecutor } from "./sqlite-executor";
import {
  DatabaseNotReadyError,
  DatabaseMigrationAuthorizationRequiredError,
  initializeAfterDatabaseReadiness,
  requireExistingDatabaseIsCurrent,
} from "./server-database-startup";
import { coreMigrationRegistry } from "./migrations/core-migration-registry";
import { FreshDatabaseBootstrap } from "./migrations/fresh-database-bootstrap";
import { MigrationRegistry } from "./migrations/migration-registry";

describe("server database startup boundary", () => {
  let sqlite: DatabaseSync;
  let database: SqliteExecutor;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    database = {
      all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
    };
  });

  afterEach(() => sqlite.close());

  it("initializes repositories only after readiness succeeds", () => {
    const initialize = vi.fn(() => ({ repository: "ready" }));
    const result = initializeAfterDatabaseReadiness(database, initialize);
    expect(result.readiness.status).toBe("READY");
    expect(result.value).toEqual({ repository: "ready" });
    expect(initialize).toHaveBeenCalledOnce();
  });

  it("never initializes repositories when readiness is blocked", () => {
    sqlite.exec("CREATE TABLE unknown_schema(id INTEGER)");
    const initialize = vi.fn();
    expect(() => initializeAfterDatabaseReadiness(database, initialize)).toThrow(DatabaseNotReadyError);
    expect(initialize).not.toHaveBeenCalled();
  });

  it("allows a current existing file but blocks legacy until explicit authorization", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mentor-startup-gate-"));
    try {
      const currentPath = path.join(root, "current.sqlite");
      const current = new DatabaseSync(currentPath);
      const currentExecutor: SqliteExecutor = {
        all: <T>(sql: string, ...params: SQLInputValue[]) => current.prepare(sql).all(...params) as T[],
        run: (sql: string, ...params: SQLInputValue[]) => current.prepare(sql).run(...params),
      };
      initializeAfterDatabaseReadiness(currentExecutor, () => undefined);
      current.close();
      expect(requireExistingDatabaseIsCurrent(currentPath)).toMatchObject({ status: "NO_MIGRATION" });

      const legacyPath = path.join(root, "legacy.sqlite");
      const legacy = new DatabaseSync(legacyPath);
      legacy.exec("CREATE TABLE unrelated(id INTEGER)");
      legacy.close();
      expect(() => requireExistingDatabaseIsCurrent(legacyPath)).toThrow(
        DatabaseMigrationAuthorizationRequiredError,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 15_000);

  it("reports an existing v16 database as outdated without migrating it", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mentor-startup-v16-"));
    const databasePath = path.join(root, "synthetic.sqlite");
    try {
      const sqlite = new DatabaseSync(databasePath);
      const v16 = new MigrationRegistry(coreMigrationRegistry.migrations.filter(migration => migration.toVersion <= 16));
      const executor: SqliteExecutor = {
        all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
        run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
      };
      new FreshDatabaseBootstrap(executor, v16).run();
      sqlite.close();

      expect(() => requireExistingDatabaseIsCurrent(databasePath)).toThrow(DatabaseMigrationAuthorizationRequiredError);
      const unchanged = new DatabaseSync(databasePath, { readOnly: true });
      expect(unchanged.prepare("SELECT MAX(to_version) AS version FROM schema_migrations").get()).toEqual({ version: 16 });
      expect(unchanged.prepare("PRAGMA table_info('mcq_sessions')").all().map(column => column.name)).not.toContain("session_kind");
      unchanged.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
