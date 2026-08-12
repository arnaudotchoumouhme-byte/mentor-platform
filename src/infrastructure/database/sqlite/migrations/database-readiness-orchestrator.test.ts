import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import {
  CORE_BASELINE_STATEMENTS,
  coreBaselineMigration,
  coreMigrationRegistry,
} from "./definitions/mig-0001-core-baseline";
import {
  IMPORT_JOURNAL_SQL,
  importJournalMigration,
} from "./definitions/mig-0002-document-import-journal";
import { APPROVED_LEGACY_FINGERPRINTS } from "./legacy-schema-fingerprints";
import { LegacySchemaRecognizer } from "./legacy-schema-recognizer";
import { migrationChecksum } from "./migration-checksum";
import { MigrationRegistry } from "./migration-registry";
import { DatabaseReadinessOrchestrator } from "./database-readiness-orchestrator";

describe("DatabaseReadinessOrchestrator", () => {
  let sqlite: DatabaseSync;
  let database: SqliteExecutor;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    database = {
      all: <T>(sql: string, ...params: SQLInputValue[]) =>
        sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
    };
  });

  afterEach(() => sqlite.close());

  const readiness = (
    registry: MigrationRegistry = coreMigrationRegistry,
    recognizer?: LegacySchemaRecognizer,
  ) => new DatabaseReadinessOrchestrator(database, registry, "test", recognizer).ensureReady();

  const createLegacyCore = () => {
    for (const statement of CORE_BASELINE_STATEMENTS) sqlite.exec(statement);
  };

  const history = () =>
    sqlite.prepare("SELECT migration_id,application_kind FROM schema_migrations ORDER BY to_version").all();

  it("bootstraps a fresh database through every registered migration", () => {
    const result = readiness();
    expect(result).toMatchObject({
      status: "READY",
      initialState: "FRESH",
      finalVersion: 5,
      appliedMigrationIds: ["MIG-0001", "MIG-0002", "MIG-0003", "MIG-0004", "MIG-0005"],
    });
    expect(history()).toHaveLength(5);
  });

  it("adopts a recognized legacy core and preserves business data", () => {
    createLegacyCore();
    sqlite.prepare("INSERT INTO subjects(name,color,mastery) VALUES(?,?,?)").run("Synthetic", "#000", 7);
    const before = sqlite.prepare("SELECT * FROM subjects").all();
    const result = readiness();
    expect(result).toMatchObject({ status: "READY", initialState: "LEGACY_RECOGNIZED" });
    expect(sqlite.prepare("SELECT * FROM subjects").all()).toEqual(before);
    expect(history()).toEqual([
      { migration_id: "MIG-0001", application_kind: "adopted_baseline" },
      { migration_id: "MIG-0002", application_kind: "executed" },
      { migration_id: "MIG-0003", application_kind: "executed" },
      { migration_id: "MIG-0004", application_kind: "executed" },
      { migration_id: "MIG-0005", application_kind: "executed" },
    ]);
  });

  it("adopts a compatible legacy journal without recreating or mutating it", () => {
    createLegacyCore();
    sqlite.exec(IMPORT_JOURNAL_SQL);
    sqlite.prepare(`INSERT INTO document_import_journal VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
      "synthetic-id", ".pdf", "Synthetic.pdf", "application/pdf", 4, "Test", "Prêt",
      "safe", "ready", 1, 42,
    );
    const legacyColumns = "storage_id,extension,display_name,media_type,size,subject,document_status,content,state,created_at,document_id";
    const before = sqlite.prepare(`SELECT ${legacyColumns} FROM document_import_journal`).all();
    const result = readiness();
    expect(result).toMatchObject({ status: "READY", initialState: "LEGACY_RECOGNIZED" });
    expect(sqlite.prepare(`SELECT ${legacyColumns} FROM document_import_journal`).all()).toEqual(before);
    expect(history()[1]).toEqual({ migration_id: "MIG-0002", application_kind: "adopted_existing" });
  });

  it("upgrades a versioned MIG-0001 database without duplicating history", () => {
    const v1 = new MigrationRegistry([coreBaselineMigration]);
    expect(readiness(v1)).toMatchObject({ status: "READY", finalVersion: 1 });
    const result = readiness();
    expect(result).toMatchObject({
      status: "READY",
      initialState: "VERSIONED_OUTDATED",
      appliedMigrationIds: ["MIG-0002", "MIG-0003", "MIG-0004", "MIG-0005"],
    });
    expect(history()).toHaveLength(5);
  });

  it("is a mutation-free no-op for a current database and remains idempotent", () => {
    expect(readiness().status).toBe("READY");
    const schemaBefore = sqlite.prepare("SELECT type,name,sql FROM sqlite_schema ORDER BY type,name").all();
    const historyBefore = history();
    const second = readiness();
    expect(second).toMatchObject({
      status: "READY",
      initialState: "VERSIONED_CURRENT",
      appliedMigrationIds: [],
    });
    expect(sqlite.prepare("SELECT type,name,sql FROM sqlite_schema ORDER BY type,name").all()).toEqual(schemaBefore);
    expect(history()).toEqual(historyBefore);
  });

  it("fails closed when migration history is ahead", () => {
    readiness();
    sqlite.prepare(`INSERT INTO schema_migrations VALUES(?,?,?,?,?,?,?,?,?)`).run(
      "MIG-0006", 5, 6, "Future", "0".repeat(64), new Date(0).toISOString(), 0, "executed", null,
    );
    const before = history();
    expect(readiness()).toMatchObject({ status: "BLOCKED", initialState: "VERSIONED_AHEAD", reason: "MIGRATION_HISTORY_AHEAD" });
    expect(history()).toEqual(before);
  });

  it.each([
    ["unknown", "CREATE TABLE unrelated(id INTEGER)", "LEGACY_UNKNOWN", "UNKNOWN_LEGACY_SCHEMA"],
    ["partial", "PARTIAL_FIXTURE", "LEGACY_PARTIAL", "PARTIAL_LEGACY_SCHEMA"],
  ])("fails closed for %s unversioned schemas", (_label, sql, state, reason) => {
    if (sql === "PARTIAL_FIXTURE") {
      createLegacyCore();
      sqlite.exec("DROP TABLE weaknesses");
    } else {
      sqlite.exec(sql);
    }
    const before = sqlite.prepare("SELECT type,name,sql FROM sqlite_schema ORDER BY type,name").all();
    expect(readiness()).toMatchObject({ status: "BLOCKED", initialState: state, reason });
    expect(sqlite.prepare("SELECT type,name,sql FROM sqlite_schema ORDER BY type,name").all()).toEqual(before);
  });

  it("fails closed for an ambiguous recognized legacy schema", () => {
    createLegacyCore();
    const duplicate = { ...APPROVED_LEGACY_FINGERPRINTS[0], id: "DUPLICATE" };
    const recognizer = new LegacySchemaRecognizer([APPROVED_LEGACY_FINGERPRINTS[0], duplicate]);
    expect(readiness(coreMigrationRegistry, recognizer)).toMatchObject({
      status: "BLOCKED",
      initialState: "LEGACY_AMBIGUOUS",
      reason: "AMBIGUOUS_LEGACY_SCHEMA",
    });
    expect(sqlite.prepare("SELECT name FROM sqlite_schema WHERE name='schema_migrations'").get()).toBeUndefined();
  });

  it("fails closed for malformed and invalid history", () => {
    sqlite.exec("CREATE TABLE schema_migrations(unrelated TEXT)");
    expect(readiness()).toMatchObject({ status: "BLOCKED", initialState: "INVALID_HISTORY" });
  });

  it("fails closed without rewriting a checksum mismatch", () => {
    readiness();
    sqlite.prepare("UPDATE schema_migrations SET checksum=? WHERE migration_id='MIG-0001'").run("f".repeat(64));
    expect(readiness()).toMatchObject({ status: "BLOCKED", initialState: "CHECKSUM_MISMATCH", reason: "MIGRATION_CHECKSUM_MISMATCH" });
    expect(sqlite.prepare("SELECT checksum FROM schema_migrations WHERE migration_id='MIG-0001'").get()).toEqual({ checksum: "f".repeat(64) });
  });

  it("fails closed for a schema incompatible with recorded current history", () => {
    readiness();
    sqlite.exec("DROP TABLE document_import_journal; CREATE TABLE document_import_journal(storage_id TEXT PRIMARY KEY)");
    expect(readiness()).toMatchObject({ status: "BLOCKED", initialState: "SCHEMA_INCOMPATIBLE", reason: "IMPORT_JOURNAL_SCHEMA_INCOMPATIBLE" });
  });

  it("rolls back and does not record a failing pending migration", () => {
    const failing = {
      id: "MIG-0003",
      fromVersion: 2,
      toVersion: 3,
      description: "Synthetic failure",
      checksumMaterial: ["synthetic-failure-v1"],
      up: (executor: SqliteExecutor) => {
        executor.run("CREATE TABLE must_rollback(id INTEGER)");
        throw new Error("synthetic");
      },
    };
    const registry = new MigrationRegistry([coreBaselineMigration, importJournalMigration, failing]);
    const result = readiness(registry);
    expect(result).toMatchObject({ status: "BLOCKED", initialState: "MIGRATION_FAILED", reason: "MIGRATION_EXECUTION_ERROR" });
    expect(sqlite.prepare("SELECT name FROM sqlite_schema WHERE name='must_rollback'").get()).toBeUndefined();
    expect(history().map((row) => row.migration_id)).toEqual(["MIG-0001", "MIG-0002"]);
  });

  it("uses immutable canonical checksums in the current history", () => {
    readiness();
    expect(sqlite.prepare("SELECT checksum FROM schema_migrations WHERE migration_id='MIG-0002'").get()).toEqual({ checksum: migrationChecksum(importJournalMigration) });
  });
});
