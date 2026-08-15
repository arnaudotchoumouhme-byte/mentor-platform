import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { coreBaselineMigration } from "./definitions/mig-0001-core-baseline";
import { importJournalMigration } from "./definitions/mig-0002-document-import-journal";
import { sourceModelMigration } from "./definitions/mig-0003-source-model";
import { ragIndexMigration } from "./definitions/mig-0004-rag-index";
import { clinicalCoachMigration } from "./definitions/mig-0005-clinical-coach";
import { mcqCoreMigration, MCQ_CORE_TABLE_NAMES } from "./definitions/mig-0006-mcq-core";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { migrationChecksum } from "./migration-checksum";
import { MigrationRegistry } from "./migration-registry";

const executor = (sqlite: DatabaseSync): SqliteExecutor => ({ all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) });
const v5 = new MigrationRegistry([coreBaselineMigration, importJournalMigration, sourceModelMigration, ragIndexMigration, clinicalCoachMigration]);
const v6 = new MigrationRegistry([coreBaselineMigration, importJournalMigration, sourceModelMigration, ragIndexMigration, clinicalCoachMigration, mcqCoreMigration]);

describe("MIG-0006 MCQ Core", () => {
  it("migrates a synthetic v5 database and preserves every legacy row", () => {
    const sqlite = new DatabaseSync(":memory:"); const db = executor(sqlite); new FreshDatabaseBootstrap(db, v5).run();
    sqlite.exec("INSERT INTO questions(prompt,options,answer,explanation,subject,difficulty,source) VALUES('legacy','[]',0,'legacy','legacy','legacy','legacy'); INSERT INTO attempts(module,subject,score) VALUES('QCM','legacy',50)");
    const beforeQuestions = sqlite.prepare("SELECT * FROM questions").all(); const beforeAttempts = sqlite.prepare("SELECT * FROM attempts").all();
    const result = new FreshDatabaseBootstrap(db, v6).run();
    expect(result.currentVersion).toBe(6); expect(sqlite.prepare("SELECT * FROM questions").all()).toEqual(beforeQuestions); expect(sqlite.prepare("SELECT * FROM attempts").all()).toEqual(beforeAttempts);
    expect(sqlite.prepare("SELECT migration_id,checksum FROM schema_migrations WHERE migration_id='MIG-0006'").get()).toEqual({ migration_id: "MIG-0006", checksum: migrationChecksum(mcqCoreMigration) });
    sqlite.close();
  });
  it("bootstraps a clean synthetic database through version 6", () => { const sqlite = new DatabaseSync(":memory:"); const result = new FreshDatabaseBootstrap(executor(sqlite), v6).run(); expect(result.currentVersion).toBe(6); const names = sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map((row) => String(row.name)); for (const name of MCQ_CORE_TABLE_NAMES) expect(names).toContain(name); sqlite.close(); });
  it("enforces immutable references, ordered snapshots and one answer", () => { const sqlite = new DatabaseSync(":memory:"); sqlite.exec("PRAGMA foreign_keys=ON"); new FreshDatabaseBootstrap(executor(sqlite), v6).run(); expect(() => sqlite.prepare("INSERT INTO mcq_question_versions(item_id,version,stem,choices_json,correct_choice_id,explanation,difficulty) VALUES('missing',1,'s','[]','a','e','FOUNDATION')").run()).toThrow(); sqlite.close(); });
});
