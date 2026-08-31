import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { coreMigrationRegistry as v13 } from "./definitions/mig-0001-core-baseline";
import { coreMigrationRegistry } from "./core-migration-registry";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { migrationChecksum } from "./migration-checksum";
import { mcqContentImportMigration } from "./definitions/mig-0014-mcq-content-import";
import { MigrationRegistry } from "./migration-registry";

const executor = (sqlite: DatabaseSync): SqliteExecutor => ({ all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) });
describe("MIG-0014 MCQ content import", () => {
  it("migrates a synthetic v13 database additively to v14", () => { const sqlite = new DatabaseSync(":memory:"); const db = executor(sqlite); const v14 = new MigrationRegistry(coreMigrationRegistry.migrations.filter(migration => !["MIG-0015", "MIG-0016"].includes(migration.id))); new FreshDatabaseBootstrap(db, v13).run(); sqlite.prepare("INSERT INTO questions(prompt,options,answer,explanation,subject,difficulty,source) VALUES('legacy','[]',0,'legacy','legacy','legacy','legacy')").run(); expect(new FreshDatabaseBootstrap(db, v14).run()).toMatchObject({ currentVersion: 14, appliedMigrationIds: ["MIG-0014"] }); expect(sqlite.prepare("SELECT prompt FROM questions").get()).toEqual({ prompt: "legacy" }); expect(sqlite.prepare("SELECT checksum FROM schema_migrations WHERE migration_id='MIG-0014'").get()).toEqual({ checksum: migrationChecksum(mcqContentImportMigration) }); expect(sqlite.prepare("PRAGMA foreign_key_list(mcq_item_editorial_metadata)").all()).toEqual(expect.arrayContaining([expect.objectContaining({ table: "source_versions", from: "source_version_id", on_delete: "RESTRICT" }), expect.objectContaining({ table: "mcq_question_versions", on_delete: "RESTRICT" })])); expect(sqlite.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" }); sqlite.close(); });
});
