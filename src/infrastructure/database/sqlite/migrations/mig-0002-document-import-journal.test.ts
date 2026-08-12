import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SqliteExecutor } from "../sqlite-executor";
import { CORE_BASELINE_STATEMENTS, coreMigrationRegistry } from "./definitions/mig-0001-core-baseline";
import {
  assertImportJournalSchema,
  IMPORT_JOURNAL_SQL,
  importJournalMigration,
} from "./definitions/mig-0002-document-import-journal";
import { LegacyBaselineAdopter } from "./legacy-baseline-adopter";
import { migrationChecksum } from "./migration-checksum";
import { MigrationRunner } from "./migration-runner";
import { SqliteMigrationHistoryStore } from "./sqlite-migration-history-store";

describe("MIG-0002 import journal with isolated SQLite", () => {
  let sqlite: DatabaseSync;
  let executor: SqliteExecutor;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    executor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
    };
  });
  afterEach(() => sqlite.close());

  function legacyCore(): void {
    for (const statement of CORE_BASELINE_STATEMENTS) sqlite.exec(statement);
    sqlite.exec("INSERT INTO documents(name,type,size,subject,status,content) VALUES('synthetic','TXT',1,'s','ready','x')");
  }

  it("is registered as deterministic version 1 to 2", () => {
    expect(coreMigrationRegistry.currentVersion).toBe(5);
    expect(coreMigrationRegistry.findById("MIG-0002")).toEqual(importJournalMigration);
    expect(migrationChecksum(importJournalMigration)).toBe(migrationChecksum(importJournalMigration));
  });

  it("advances an adopted core legacy DB without changing business data", () => {
    legacyCore();
    new LegacyBaselineAdopter(executor).adopt();
    const before = sqlite.prepare("SELECT * FROM documents").all();
    const history = new SqliteMigrationHistoryStore(executor);

    expect(new MigrationRunner(executor, history).runPending(coreMigrationRegistry)).toEqual({
      currentVersion: 5,
      appliedMigrationIds: ["MIG-0002", "MIG-0003", "MIG-0004", "MIG-0005"],
    });
    expect(() => assertImportJournalSchema(executor)).not.toThrow();
    expect(sqlite.prepare("SELECT * FROM documents").all()).toEqual(before);
    expect(history.list()[1]).toEqual(expect.objectContaining({
      migrationId: "MIG-0002",
      applicationKind: "executed",
      checksum: migrationChecksum(importJournalMigration),
    }));
    expect(new MigrationRunner(executor, history).runPending(coreMigrationRegistry).appliedMigrationIds).toEqual([]);
  });

  it("fails closed for an incompatible existing journal", () => {
    legacyCore();
    sqlite.exec("CREATE TABLE document_import_journal(storage_id TEXT PRIMARY KEY, payload TEXT)");
    expect(() => new LegacyBaselineAdopter(executor).adopt()).toThrow();
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").all()).toEqual([]);
    expect(sqlite.prepare("PRAGMA table_info(document_import_journal)").all()).toHaveLength(2);
  });

  it("records a compatible journal already present on a version-1 database as adopted", () => {
    legacyCore();
    new LegacyBaselineAdopter(executor).adopt();
    sqlite.exec(IMPORT_JOURNAL_SQL);
    const history = new SqliteMigrationHistoryStore(executor);

    new MigrationRunner(executor, history).runPending(coreMigrationRegistry);
    expect(history.list()[1]).toEqual(expect.objectContaining({
      migrationId: "MIG-0002",
      applicationKind: "adopted_existing",
    }));
  });
});
