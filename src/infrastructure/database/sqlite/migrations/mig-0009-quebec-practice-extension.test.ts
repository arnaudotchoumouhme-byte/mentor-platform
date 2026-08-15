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
import { canadianPracticeCoreMigration } from "./definitions/mig-0008-canadian-practice-core";
import { quebecPracticeExtensionMigration } from "./definitions/mig-0009-quebec-practice-extension";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { migrationChecksum } from "./migration-checksum";
import { MigrationRegistry } from "./migration-registry";

const executor = (sqlite: DatabaseSync): SqliteExecutor => ({ all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) });
const v8 = new MigrationRegistry([coreBaselineMigration, importJournalMigration, sourceModelMigration, ragIndexMigration, clinicalCoachMigration, mcqCoreMigration, foundationAcademyCoreMigration, canadianPracticeCoreMigration]);
const v9 = new MigrationRegistry([coreBaselineMigration, importJournalMigration, sourceModelMigration, ragIndexMigration, clinicalCoachMigration, mcqCoreMigration, foundationAcademyCoreMigration, canadianPracticeCoreMigration, quebecPracticeExtensionMigration]);
const seedV8 = (sqlite: DatabaseSync) => sqlite.exec(`
  INSERT INTO subjects(name) VALUES('legacy');
  INSERT INTO documents(name,type) VALUES('TEST_FIXTURE','txt');
  INSERT INTO sources(source_id,storage_id,document_id,original_filename,display_name,media_type,extension,size_bytes,checksum,status,extraction_status,provenance_type) VALUES('source','fixture',1,'fixture.txt','TEST_FIXTURE','text/plain','txt',1,'checksum','READY','COMPLETED','TEST_FIXTURE');
  INSERT INTO source_versions(source_version_id,source_id,version,checksum,extraction_status) VALUES('source-v','source',1,'checksum','COMPLETED');
  INSERT INTO curriculum_versions VALUES('cv','program',1,'DRAFT','2027',NULL,'2026',NULL);
  INSERT INTO curriculum_blocks VALUES('block','cv','CAN','Canadian Practice',0,1);
  INSERT INTO curriculum_units VALUES('unit','block','CAN-1','Unit','TEST_FIXTURE',15,0,'ACTIVE');
  INSERT INTO learning_objectives VALUES('objective','unit','OBJ','TEST_FIXTURE','TEST_FIXTURE',0);
  INSERT INTO mcq_question_items(item_id,latest_version) VALUES('item',1);
  INSERT INTO canadian_practice_rules VALUES('rule','TEST_FIXTURE_ON','objective');
  INSERT INTO canadian_practice_rule_versions VALUES('version','rule',1,'PROVINCIAL','ON','source-v','2026-01-01','2026-01-01',NULL,'ACTIVE','TEST_FIXTURE','TEST_FIXTURE not official','2026-01-01');
`);

describe("MIG-0009 Quebec Practice Extension", () => {
  it("bootstraps a fresh synthetic database through version 9", () => {
    const sqlite = new DatabaseSync(":memory:"); const result = new FreshDatabaseBootstrap(executor(sqlite), v9).run();
    expect(result.currentVersion).toBe(9); expect(sqlite.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()).toEqual({ count: 9 });
    expect(sqlite.prepare("SELECT checksum FROM schema_migrations WHERE migration_id='MIG-0009'").get()).toEqual({ checksum: migrationChecksum(quebecPracticeExtensionMigration) }); sqlite.close();
  });
  it("migrates v8 to v9 preserving Ontario, legacy, MCQ and Foundation data", () => {
    const sqlite = new DatabaseSync(":memory:"); sqlite.exec("PRAGMA foreign_keys=ON"); const db = executor(sqlite); new FreshDatabaseBootstrap(db, v8).run(); seedV8(sqlite);
    const before = sqlite.prepare("SELECT * FROM canadian_practice_rule_versions").all(); const result = new FreshDatabaseBootstrap(db, v9).run();
    expect(result.currentVersion).toBe(9); expect(sqlite.prepare("SELECT * FROM canadian_practice_rule_versions WHERE province='ON'").all()).toEqual(before);
    expect(sqlite.prepare("SELECT name FROM subjects").get()).toEqual({ name: "legacy" }); expect(sqlite.prepare("SELECT item_id FROM mcq_question_items").get()).toEqual({ item_id: "item" }); expect(sqlite.prepare("SELECT learning_objective_id FROM learning_objectives").get()).toEqual({ learning_objective_id: "objective" });
    expect(sqlite.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    expect(sqlite.prepare("SELECT migration_id FROM schema_migrations ORDER BY to_version").all().map(({ migration_id }) => migration_id)).toEqual(["MIG-0001","MIG-0002","MIG-0003","MIG-0004","MIG-0005","MIG-0006","MIG-0007","MIG-0008","MIG-0009"]); sqlite.close();
  });
  it("accepts only coherent Federal, Ontario and Quebec rows with preserved indexes", () => {
    const sqlite = new DatabaseSync(":memory:"); sqlite.exec("PRAGMA foreign_keys=ON"); const db = executor(sqlite); new FreshDatabaseBootstrap(db, v8).run(); seedV8(sqlite); new FreshDatabaseBootstrap(db, v9).run();
    sqlite.prepare("INSERT INTO canadian_practice_rules VALUES('qc','TEST_FIXTURE_QC','objective')").run();
    const insert = (id: string, jurisdiction: string, province: string | null) => sqlite.prepare("INSERT INTO canadian_practice_rule_versions VALUES(?,?,1,?,?, 'source-v','2026','2026',NULL,'ACTIVE','TEST_FIXTURE','TEST_FIXTURE not official','2026')").run(id,id === 'qc-v' ? 'qc' : 'rule',jurisdiction,province);
    expect(() => insert('qc-v','PROVINCIAL','QC')).not.toThrow(); expect(() => insert('bad','PROVINCIAL','BC')).toThrow(); expect(() => insert('bad2','FEDERAL','QC')).toThrow();
    const indexes = sqlite.prepare("PRAGMA index_list('canadian_practice_rule_versions')").all().map(({ name }) => name); expect(indexes).toContain("canadian_practice_rule_versions_resolution"); expect(indexes).toContain("canadian_practice_rule_versions_source"); sqlite.close();
  });
});
