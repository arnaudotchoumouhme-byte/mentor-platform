import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SqliteExecutor } from "../sqlite-executor";
import { CORE_BASELINE_STATEMENTS, coreBaselineMigration } from "./definitions/mig-0001-core-baseline";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { LegacyBaselineAdopter } from "./legacy-baseline-adopter";
import { LEGACY_CORE_9 } from "./legacy-schema-fingerprints";
import { LegacySchemaRecognizer } from "./legacy-schema-recognizer";
import { migrationChecksum } from "./migration-checksum";
import { MigrationError } from "./migration-errors";
import { SqliteMigrationHistoryStore } from "./sqlite-migration-history-store";
import { SqliteSchemaInspector } from "./sqlite-schema-inspector";

const JOURNAL_SQL = `CREATE TABLE document_import_journal (
 storage_id TEXT PRIMARY KEY, extension TEXT NOT NULL, display_name TEXT NOT NULL,
 media_type TEXT NOT NULL, size INTEGER NOT NULL, subject TEXT NOT NULL,
 document_status TEXT NOT NULL, content TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','ready','missing')),
 created_at INTEGER NOT NULL, document_id INTEGER)`;

describe("LegacyBaselineAdopter with synthetic in-memory legacy data", () => {
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

  function createCoreWithSyntheticData(): void {
    for (const statement of CORE_BASELINE_STATEMENTS) sqlite.exec(statement);
    sqlite.exec(`
      INSERT INTO subjects(name,color,mastery) VALUES('Synthetic','#000000',1);
      INSERT INTO documents(name,type,size,subject,status,content) VALUES('synthetic.txt','TXT',1,'Synthetic','Ready','x');
      INSERT INTO flashcards(front,back,subject) VALUES('f','b','Synthetic');
      INSERT INTO questions(prompt,options,answer,explanation,subject,difficulty,source) VALUES('q','[]',0,'e','Synthetic','Easy','synthetic');
      INSERT INTO attempts(module,subject,score) VALUES('m','Synthetic',1);
      INSERT INTO weaknesses(subject,topic,confidence,cause,action) VALUES('Synthetic','t','c','cause','action');
      INSERT INTO study_tasks(title,subject,task_date,minutes) VALUES('t','Synthetic','2026-01-01',1);
      INSERT INTO conversations(role,content) VALUES('user','synthetic');
      INSERT INTO settings(key,value) VALUES('synthetic','value');
    `);
  }

  function businessState(): string {
    const snapshot = new SqliteSchemaInspector(executor).inspect();
    const rows = ["attempts","conversations","documents","flashcards","questions","settings","study_tasks","subjects","weaknesses"]
      .map((table) => [table, sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]);
    return JSON.stringify({
      schema: snapshot.tables.filter(({ kind }) => kind === "APPLICATION_TABLE"),
      rows,
    });
  }

  it.each([
    ["core", false, "LEGACY_CORE_9"],
    ["journal", true, "LEGACY_CORE_9_WITH_IMPORT_JOURNAL"],
  ])("adopts recognized %s legacy without changing business schema or rows", (_label, journal, fingerprintId) => {
    createCoreWithSyntheticData();
    if (journal) sqlite.exec(JOURNAL_SQL);
    const before = businessState();

    expect(new LegacyBaselineAdopter(executor).adopt()).toEqual({
      status: "ADOPTED_BASELINE",
      fingerprintId,
      currentVersion: journal ? 2 : 1,
    });
    expect(businessState()).toBe(before);
    const history = new SqliteMigrationHistoryStore(executor).list();
    expect(history[0]).toEqual(expect.objectContaining({
        migrationId: "MIG-0001",
        checksum: migrationChecksum(coreBaselineMigration),
        applicationKind: "adopted_baseline",
    }));
    expect(history).toHaveLength(journal ? 2 : 1);
    if (journal) expect(history[1]).toEqual(expect.objectContaining({ migrationId: "MIG-0002", applicationKind: "adopted_existing" }));
  });

  it("does not duplicate adoption on a second sequential attempt", () => {
    createCoreWithSyntheticData();
    const adopter = new LegacyBaselineAdopter(executor);
    adopter.adopt();

    expect(adopter.adopt()).toEqual({ status: "ALREADY_VERSIONED", fingerprintId: null, currentVersion: 1 });
    expect(new SqliteMigrationHistoryStore(executor).list()).toHaveLength(1);
  });

  it.each([
    ["fresh", "", "LEGACY_ADOPTION_NOT_ALLOWED"],
    ["unknown", "CREATE TABLE unrelated(id INTEGER)", "UNKNOWN_LEGACY_SCHEMA"],
    ["partial", "core-partial", "PARTIAL_LEGACY_SCHEMA"],
  ])("rejects %s databases without creating history", (_label, setup, code) => {
    if (setup === "core-partial") {
      createCoreWithSyntheticData();
      sqlite.exec("DROP TABLE weaknesses");
    } else if (setup) sqlite.exec(setup);
    try {
      new LegacyBaselineAdopter(executor).adopt();
      throw new Error("Expected rejection.");
    } catch (error) {
      expect(error).toBeInstanceOf(MigrationError);
      expect((error as MigrationError).code).toBe(code);
    }
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").all()).toEqual([]);
  });

  it("rejects ambiguous recognition", () => {
    createCoreWithSyntheticData();
    const duplicate = { ...LEGACY_CORE_9, id: "DUPLICATE" };
    const recognizer = new LegacySchemaRecognizer([LEGACY_CORE_9, duplicate]);
    expect(() => new LegacyBaselineAdopter(executor, recognizer).adopt()).toThrow(MigrationError);
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").all()).toEqual([]);
  });

  it("validates already-versioned checksum and ahead states without re-adoption", () => {
    new FreshDatabaseBootstrap(executor).run();
    sqlite.prepare("UPDATE schema_migrations SET checksum=?").run("f".repeat(64));
    expect(() => new LegacyBaselineAdopter(executor).adopt()).toThrow(MigrationError);
  });

  it("rejects already-versioned history ahead of the registry", () => {
    new FreshDatabaseBootstrap(executor).run();
    sqlite.prepare(`INSERT INTO schema_migrations (
      migration_id,from_version,to_version,description,checksum,applied_at,
      duration_ms,application_kind,application_version
    ) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      "MIG-0006", 5, 6, "Future", "b".repeat(64),
      "2026-08-09T12:00:00.000Z", 1, "executed", null,
    );
    try {
      new LegacyBaselineAdopter(executor).adopt();
      throw new Error("Expected ahead-history rejection.");
    } catch (error) {
      expect(error).toBeInstanceOf(MigrationError);
      expect((error as MigrationError).code).toBe("MIGRATION_HISTORY_AHEAD");
    }
  });

  it("rolls back metadata when adoption insertion fails and remains retryable", () => {
    createCoreWithSyntheticData();
    const before = businessState();
    let failInsert = true;
    const failingExecutor: SqliteExecutor = {
      all: executor.all,
      run: (sql, ...params) => {
        if (failInsert && sql.startsWith("INSERT INTO schema_migrations")) throw new Error("synthetic metadata failure");
        return executor.run(sql, ...params);
      },
    };

    expect(() => new LegacyBaselineAdopter(failingExecutor).adopt()).toThrow("rolled back");
    expect(businessState()).toBe(before);
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").all()).toEqual([]);
    failInsert = false;
    expect(new LegacyBaselineAdopter(failingExecutor).adopt().status).toBe("ADOPTED_BASELINE");
  });
});
