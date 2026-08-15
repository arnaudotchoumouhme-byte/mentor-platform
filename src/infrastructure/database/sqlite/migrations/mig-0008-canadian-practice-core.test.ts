import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { coreBaselineMigration } from "./definitions/mig-0001-core-baseline";
import { importJournalMigration } from "./definitions/mig-0002-document-import-journal";
import { sourceModelMigration } from "./definitions/mig-0003-source-model";
import { ragIndexMigration } from "./definitions/mig-0004-rag-index";
import { clinicalCoachMigration } from "./definitions/mig-0005-clinical-coach";
import { mcqCoreMigration } from "./definitions/mig-0006-mcq-core";
import { foundationAcademyCoreMigration } from "./definitions/mig-0007-foundation-academy-core";
import { CANADIAN_PRACTICE_TABLE_NAMES, canadianPracticeCoreMigration } from "./definitions/mig-0008-canadian-practice-core";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { migrationChecksum } from "./migration-checksum";
import { MigrationRegistry } from "./migration-registry";

const executor = (sqlite: DatabaseSync): SqliteExecutor => ({ all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) });
const v7 = new MigrationRegistry([coreBaselineMigration, importJournalMigration, sourceModelMigration, ragIndexMigration, clinicalCoachMigration, mcqCoreMigration, foundationAcademyCoreMigration]);
const v8 = new MigrationRegistry([coreBaselineMigration, importJournalMigration, sourceModelMigration, ragIndexMigration, clinicalCoachMigration, mcqCoreMigration, foundationAcademyCoreMigration, canadianPracticeCoreMigration]);

describe("MIG-0008 Canadian Practice Core", () => {
  it("bootstraps a fresh synthetic database through version 8", () => {
    const sqlite = new DatabaseSync(":memory:"); const result = new FreshDatabaseBootstrap(executor(sqlite), v8).run();
    expect(result.currentVersion).toBe(8);
    const tables = sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(({ name }) => String(name));
    for (const table of CANADIAN_PRACTICE_TABLE_NAMES) expect(tables).toContain(table);
    expect(sqlite.prepare("SELECT checksum FROM schema_migrations WHERE migration_id='MIG-0008'").get()).toEqual({ checksum: migrationChecksum(canadianPracticeCoreMigration) });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()).toEqual({ count: 8 }); sqlite.close();
  });
  it("migrates synthetic v7 to v8 while preserving legacy, MCQ and Foundation data", () => {
    const sqlite = new DatabaseSync(":memory:"); const db = executor(sqlite); new FreshDatabaseBootstrap(db, v7).run();
    sqlite.exec("INSERT INTO subjects(name) VALUES('legacy'); INSERT INTO curriculum_versions VALUES('cv','program',1,'DRAFT','2027',NULL,'2026',NULL); INSERT INTO mcq_question_items(item_id,latest_version) VALUES('item',1);");
    const result = new FreshDatabaseBootstrap(db, v8).run();
    expect(result.currentVersion).toBe(8); expect(sqlite.prepare("SELECT name FROM subjects").get()).toEqual({ name: "legacy" }); expect(sqlite.prepare("SELECT curriculum_version_id FROM curriculum_versions").get()).toEqual({ curriculum_version_id: "cv" }); expect(sqlite.prepare("SELECT item_id FROM mcq_question_items").get()).toEqual({ item_id: "item" });
    expect(sqlite.prepare("SELECT migration_id FROM schema_migrations ORDER BY to_version").all().map(({ migration_id }) => migration_id)).toEqual(["MIG-0001","MIG-0002","MIG-0003","MIG-0004","MIG-0005","MIG-0006","MIG-0007","MIG-0008"]); sqlite.close();
  });
  it("creates restrictive foreign keys, closed enums and resolution indexes", () => {
    const sqlite = new DatabaseSync(":memory:"); sqlite.exec("PRAGMA foreign_keys=ON"); new FreshDatabaseBootstrap(executor(sqlite), v8).run();
    expect(() => sqlite.prepare("INSERT INTO canadian_practice_rules VALUES('r','code','missing')").run()).toThrow();
    const indexes = sqlite.prepare("PRAGMA index_list('canadian_practice_rule_versions')").all().map(({ name }) => name);
    expect(indexes).toContain("canadian_practice_rule_versions_resolution"); expect(indexes).toContain("canadian_practice_rule_versions_source"); sqlite.close();
  });
});
