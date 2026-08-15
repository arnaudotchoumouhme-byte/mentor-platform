import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SqliteExecutor } from "../sqlite-executor";
import {
  CORE_BASELINE_TABLE_NAMES,
  coreBaselineMigration,
  coreMigrationRegistry,
} from "./definitions/mig-0001-core-baseline";
import { MCQ_CORE_TABLE_NAMES } from "./definitions/mig-0006-mcq-core";
import { FOUNDATION_CORE_TABLE_NAMES } from "./definitions/mig-0007-foundation-academy-core";
import { CANADIAN_PRACTICE_TABLE_NAMES } from "./definitions/mig-0008-canadian-practice-core";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { migrationChecksum } from "./migration-checksum";
import type { MigrationDefinition } from "./migration-definition";
import { MigrationError } from "./migration-errors";
import { MigrationRegistry } from "./migration-registry";
import { SqliteMigrationHistoryStore } from "./sqlite-migration-history-store";
import { SqliteSchemaInspector } from "./sqlite-schema-inspector";

describe("fresh database bootstrap with isolated SQLite", () => {
  let sqlite: DatabaseSync;
  let executor: SqliteExecutor;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    executor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) =>
        sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) =>
        sqlite.prepare(sql).run(...params),
    };
  });

  afterEach(() => sqlite.close());

  it("defines the canonical baseline identity and checksum", () => {
    expect(coreBaselineMigration).toMatchObject({
      id: "MIG-0001",
      fromVersion: 0,
      toVersion: 1,
    });
    expect(migrationChecksum(coreBaselineMigration)).toMatch(/^[a-f0-9]{64}$/);
    expect(migrationChecksum(coreBaselineMigration)).toBe(
      migrationChecksum(coreBaselineMigration),
    );
  });

  it("bootstraps the canonical core schema and records its checksum once", () => {
    const bootstrap = new FreshDatabaseBootstrap(executor, coreMigrationRegistry, "test-build");
    const first = bootstrap.run();
    const snapshot = new SqliteSchemaInspector(executor).inspect();
    const history = new SqliteMigrationHistoryStore(executor).list();

    expect(first).toEqual({ currentVersion: 9, appliedMigrationIds: ["MIG-0001", "MIG-0002", "MIG-0003", "MIG-0004", "MIG-0005", "MIG-0006", "MIG-0007", "MIG-0008", "MIG-0009"] });
    expect(
      snapshot.tables
        .filter(({ kind }) => kind === "APPLICATION_TABLE")
        .map(({ name }) => name),
    ).toEqual([...CORE_BASELINE_TABLE_NAMES, "coach_learner_signals", "coaching_sessions", "document_chunks", "document_chunks_fts", "document_chunks_fts_config", "document_chunks_fts_content", "document_chunks_fts_data", "document_chunks_fts_docsize", "document_chunks_fts_idx", "document_import_journal", ...CANADIAN_PRACTICE_TABLE_NAMES, ...FOUNDATION_CORE_TABLE_NAMES, ...MCQ_CORE_TABLE_NAMES, "source_versions", "sources"].sort());
    expect(snapshot.tables.some(({ name }) => name === "document_import_journal")).toBe(true);
    expect(snapshot.views).toEqual([]);
    expect(snapshot.triggers).toEqual([]);
    expect(history).toHaveLength(9);
    expect(history[0]).toMatchObject({
      migrationId: "MIG-0001",
      fromVersion: 0,
      toVersion: 1,
      checksum: migrationChecksum(coreBaselineMigration),
      applicationKind: "executed",
      applicationVersion: "test-build",
    });
  });

  it("is idempotent for an already-current versioned database", () => {
    const bootstrap = new FreshDatabaseBootstrap(executor);
    bootstrap.run();
    const before = new SqliteSchemaInspector(executor).inspect();

    expect(bootstrap.run()).toEqual({ currentVersion: 9, appliedMigrationIds: [] });
    expect(new SqliteSchemaInspector(executor).inspect()).toEqual(before);
    expect(new SqliteMigrationHistoryStore(executor).list()).toHaveLength(9);
  });

  it.each([
    ["non-empty unknown", "CREATE TABLE unknown_table(id INTEGER, value TEXT); INSERT INTO unknown_table VALUES (1,'synthetic')"],
    ["partial legacy-like", "CREATE TABLE subjects(id INTEGER PRIMARY KEY, name TEXT)"],
    ["malformed metadata", "CREATE TABLE schema_migrations(unrelated TEXT)"],
  ])("fails closed for %s schema without mutation", (_label, sql) => {
    sqlite.exec(sql);
    const before = new SqliteSchemaInspector(executor).inspect();

    expect(() => new FreshDatabaseBootstrap(executor).run()).toThrow(MigrationError);
    expect(new SqliteSchemaInspector(executor).inspect()).toEqual(before);
    expect(
      sqlite.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").all(),
    ).toHaveLength(sql.includes("schema_migrations") ? 1 : 0);
    if (sql.includes("INSERT INTO unknown_table")) {
      expect(sqlite.prepare("SELECT * FROM unknown_table").all()).toEqual([
        { id: 1, value: "synthetic" },
      ]);
    }
  });

  it("refuses business tables paired with empty migration metadata", () => {
    new SqliteMigrationHistoryStore(executor).ensureStorage();
    sqlite.exec("CREATE TABLE unrecorded_business(id INTEGER)");
    const before = new SqliteSchemaInspector(executor).inspect();

    expect(() => new FreshDatabaseBootstrap(executor).run()).toThrow(
      "An unrecorded non-empty schema cannot use fresh database bootstrap.",
    );
    expect(new SqliteSchemaInspector(executor).inspect()).toEqual(before);
  });

  it("rolls back schema and history when a migration fails", () => {
    const failing: MigrationDefinition = {
      id: "MIG-0001",
      fromVersion: 0,
      toVersion: 1,
      description: "Synthetic failure",
      checksumMaterial: ["synthetic-failure:v1"],
      up: (database) => {
        database.run("CREATE TABLE must_rollback(id INTEGER)");
        throw new Error("synthetic failure");
      },
    };
    const bootstrap = new FreshDatabaseBootstrap(
      executor,
      new MigrationRegistry([failing]),
    );

    expect(() => bootstrap.run()).toThrow("failed and was not recorded");
    expect(
      sqlite.prepare("SELECT name FROM sqlite_master WHERE name='must_rollback'").all(),
    ).toEqual([]);
    expect(new SqliteMigrationHistoryStore(executor).list()).toEqual([]);
    expect(() => bootstrap.run()).toThrow("failed and was not recorded");
  });

  it("rolls back when post-migration structural validation fails", () => {
    const invalid: MigrationDefinition = {
      id: "MIG-0001",
      fromVersion: 0,
      toVersion: 1,
      description: "Synthetic invalid result",
      checksumMaterial: ["synthetic-invalid:v1"],
      up: (database) => {
        database.run("CREATE TABLE invalid_result(id INTEGER)");
      },
      validate: () => {
        throw new Error("invalid postcondition");
      },
    };

    expect(() =>
      new FreshDatabaseBootstrap(executor, new MigrationRegistry([invalid])).run(),
    ).toThrow("failed and was not recorded");
    expect(
      sqlite.prepare("SELECT name FROM sqlite_master WHERE name='invalid_result'").all(),
    ).toEqual([]);
    expect(new SqliteMigrationHistoryStore(executor).list()).toEqual([]);
  });

  it("fails closed when stored checksum no longer matches", () => {
    const bootstrap = new FreshDatabaseBootstrap(executor);
    bootstrap.run();
    sqlite.prepare("UPDATE schema_migrations SET checksum=?").run("f".repeat(64));

    try {
      bootstrap.run();
      throw new Error("Expected checksum mismatch.");
    } catch (error) {
      expect(error).toBeInstanceOf(MigrationError);
      expect((error as MigrationError).code).toBe("MIGRATION_CHECKSUM_MISMATCH");
    }
    expect(new SqliteMigrationHistoryStore(executor).list()).toHaveLength(9);
  });

  it("fails closed when stored history is ahead of the registry", () => {
    new FreshDatabaseBootstrap(executor).run();
    sqlite.prepare(`INSERT INTO schema_migrations (
      migration_id,from_version,to_version,description,checksum,applied_at,
      duration_ms,application_kind,application_version
    ) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      "MIG-0010", 9, 10, "Future", "b".repeat(64),
      "2026-08-09T12:00:00.000Z", 1, "executed", null,
    );

    try {
      new FreshDatabaseBootstrap(executor).run();
      throw new Error("Expected history-ahead failure.");
    } catch (error) {
      expect(error).toBeInstanceOf(MigrationError);
      expect((error as MigrationError).code).toBe("MIGRATION_HISTORY_AHEAD");
    }
  });
});
