import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { coreBaselineMigration } from "./definitions/mig-0001-core-baseline";
import { importJournalMigration } from "./definitions/mig-0002-document-import-journal";
import { sourceModelMigration } from "./definitions/mig-0003-source-model";
import { ragIndexMigration } from "./definitions/mig-0004-rag-index";
import { clinicalCoachMigration } from "./definitions/mig-0005-clinical-coach";
import { mcqCoreMigration } from "./definitions/mig-0006-mcq-core";
import { FOUNDATION_CORE_TABLE_NAMES, foundationAcademyCoreMigration } from "./definitions/mig-0007-foundation-academy-core";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { migrationChecksum } from "./migration-checksum";
import { MigrationRegistry } from "./migration-registry";

const executor = (sqlite: DatabaseSync): SqliteExecutor => ({ all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) });
const v6 = new MigrationRegistry([coreBaselineMigration, importJournalMigration, sourceModelMigration, ragIndexMigration, clinicalCoachMigration, mcqCoreMigration]);
const v7 = new MigrationRegistry([...v6.migrations, foundationAcademyCoreMigration]);

const insertCurriculumSkeleton = (sqlite: DatabaseSync): void => {
  sqlite.exec(`
    INSERT INTO curriculum_versions VALUES('cv','program',1,'DRAFT','2027-01-01',NULL,'2026-08-13',NULL);
    INSERT INTO curriculum_blocks VALUES('block','cv','BIO','Biomedical',0,1);
    INSERT INTO curriculum_units VALUES('unit','block','U1','Unit','Description',30,0,'ACTIVE');
    INSERT INTO curriculum_units VALUES('required','block','U2','Required unit','Description',30,1,'ACTIVE');
  `);
};

describe("MIG-0007 Foundation Academy Core", () => {
  it("bootstraps a fresh synthetic database through version 7", () => {
    const sqlite = new DatabaseSync(":memory:");
    const result = new FreshDatabaseBootstrap(executor(sqlite), v7).run();
    expect(result.currentVersion).toBe(7);
    const tables = sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(({ name }) => String(name));
    for (const table of FOUNDATION_CORE_TABLE_NAMES) expect(tables).toContain(table);
    expect(sqlite.prepare("SELECT migration_id,checksum FROM schema_migrations WHERE migration_id='MIG-0007'").get()).toEqual({ migration_id: "MIG-0007", checksum: migrationChecksum(foundationAcademyCoreMigration) });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()).toEqual({ count: 7 });
    sqlite.close();
  });

  it("migrates synthetic v6 to v7 without changing legacy or MCQ data", () => {
    const sqlite = new DatabaseSync(":memory:");
    const db = executor(sqlite);
    new FreshDatabaseBootstrap(db, v6).run();
    sqlite.exec(`
      INSERT INTO subjects(name) VALUES('legacy');
      INSERT INTO mcq_question_items(item_id,latest_version) VALUES('item',1);
      INSERT INTO mcq_question_versions(item_id,version,stem,choices_json,correct_choice_id,explanation,difficulty) VALUES('item',1,'Stem','[{"id":"a","text":"A"},{"id":"b","text":"B"}]','a','Explanation','FOUNDATION');
    `);
    const legacy = sqlite.prepare("SELECT * FROM subjects").all();
    const mcq = sqlite.prepare("SELECT * FROM mcq_question_versions").all();
    const result = new FreshDatabaseBootstrap(db, v7).run();
    expect(result.currentVersion).toBe(7);
    expect(sqlite.prepare("SELECT * FROM subjects").all()).toEqual(legacy);
    expect(sqlite.prepare("SELECT * FROM mcq_question_versions").all()).toEqual(mcq);
    expect(sqlite.prepare("SELECT migration_id FROM schema_migrations ORDER BY to_version").all().map(({ migration_id }) => migration_id)).toEqual(["MIG-0001", "MIG-0002", "MIG-0003", "MIG-0004", "MIG-0005", "MIG-0006", "MIG-0007"]);
    sqlite.close();
  });

  it("enforces foreign keys, enums, uniqueness and one active unit progress", () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec("PRAGMA foreign_keys=ON");
    new FreshDatabaseBootstrap(executor(sqlite)).run();
    expect(() => sqlite.prepare("INSERT INTO curriculum_blocks VALUES('bad','missing','BIO','Bad',0,1)").run()).toThrow();
    expect(() => sqlite.prepare("INSERT INTO curriculum_versions VALUES('bad','program',1,'INVALID','2027',NULL,'2026',NULL)").run()).toThrow();
    insertCurriculumSkeleton(sqlite);
    expect(() => sqlite.prepare("INSERT INTO curriculum_versions VALUES('cv2','program',1,'DRAFT','2028',NULL,'2026',NULL)").run()).toThrow();
    sqlite.prepare("INSERT INTO prerequisite_rules VALUES('r1','unit','required',NULL,NULL,'2026')").run();
    expect(() => sqlite.prepare("INSERT INTO prerequisite_rules VALUES('r2','unit','required',NULL,NULL,'2026')").run()).toThrow();
    sqlite.prepare("INSERT INTO foundation_unit_progress VALUES('p1','learner','cv','unit','PRE_TEST','IN_PROGRESS','2026','2026',NULL)").run();
    expect(() => sqlite.prepare("INSERT INTO foundation_unit_progress VALUES('p2','learner','cv','unit','PRE_TEST','IN_PROGRESS','2026','2026',NULL)").run()).toThrow();
    expect(() => sqlite.prepare("INSERT INTO mastery_estimates VALUES('m','learner','cv','block','unit',NULL,'N9',0.5,'2026','[]','v1')").run()).toThrow();
    sqlite.close();
  });
});
