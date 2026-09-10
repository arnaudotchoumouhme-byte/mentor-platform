import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { coreMigrationRegistry } from "./core-migration-registry";
import { MigrationRegistry } from "./migration-registry";
import { assertMleCatalogSchema, mleConceptCatalogMigration, MLE_CATALOG_TABLES } from "./definitions/mig-0018-mle-concept-catalog";
import { DatabaseMigrationPreflight } from "../preflight/database-migration-preflight";
import { migrationChecksum } from "./migration-checksum";

const executor = (sqlite: DatabaseSync): SqliteExecutor => ({ all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql, ...params) => sqlite.prepare(sql).run(...params) });
const v17 = new MigrationRegistry(coreMigrationRegistry.migrations.filter(m => m.toVersion <= 17));
describe("MIG-0018 additive MLE catalog", () => {
  let sqlite: DatabaseSync;
  let db: SqliteExecutor;
  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    db = executor(sqlite);
    new FreshDatabaseBootstrap(db, v17).run();
  });
  afterEach(() => sqlite.close());
  it("preserves v17 history and legacy data and validates a fresh v18", () => {

    sqlite.exec("INSERT INTO subjects(name,mastery) VALUES('legacy',72)");
    const history = sqlite.prepare("SELECT * FROM schema_migrations ORDER BY to_version").all();
    expect(new DatabaseMigrationPreflight(db).inspect()).toMatchObject({ status: "BLOCKED", currentVersion: 17, targetVersion: 18, backupRequirement: "BACKUP_REQUIRED_MISSING", migrationAllowed: false });
    expect(new FreshDatabaseBootstrap(db).run()).toEqual({ currentVersion: 18, appliedMigrationIds: ["MIG-0018"] });
    expect(sqlite.prepare("SELECT * FROM schema_migrations WHERE to_version<=17 ORDER BY to_version").all()).toEqual(history);
    expect(sqlite.prepare("SELECT name,mastery FROM subjects").get()).toEqual({ name: "legacy", mastery: 72 });
    expect(sqlite.prepare("SELECT checksum FROM schema_migrations WHERE migration_id='MIG-0018'").get()).toEqual({ checksum: migrationChecksum(mleConceptCatalogMigration) });
    expect(new DatabaseMigrationPreflight(db).inspect()).toMatchObject({ status: "NO_MIGRATION", currentVersion: 18 });
    expect(sqlite.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
  });
  it("is idempotent and detects a missing dependency index", () => {
    new FreshDatabaseBootstrap(db).run();
    expect(new FreshDatabaseBootstrap(db).run().appliedMigrationIds).toEqual([]);
    sqlite.exec("DROP INDEX mle_dependencies_target");
    expect(() => assertMleCatalogSchema(db)).toThrow();
  });
  it("rolls back tables and history after a mid-migration failure", () => {

    const bad = { ...mleConceptCatalogMigration, up: (database: SqliteExecutor) => { mleConceptCatalogMigration.up(database); database.run("INVALID SQL"); } };
    expect(() => new FreshDatabaseBootstrap(db, new MigrationRegistry([...v17.migrations, bad])).run()).toThrow();
    for (const name of MLE_CATALOG_TABLES) expect(sqlite.prepare("SELECT name FROM sqlite_schema WHERE name=?").get(name)).toBeUndefined();
    expect(sqlite.prepare("SELECT name FROM sqlite_schema WHERE name='mle_source_versions_identity'").get()).toBeUndefined();
    expect(sqlite.prepare("SELECT MAX(to_version) AS version FROM schema_migrations").get()).toEqual({ version: 17 });
  });
  it("rejects the obsolete synthetic checksum and detects a missing source identity index", () => {
    new FreshDatabaseBootstrap(db).run();
    // Checksum of the development-only definition at 4cafa63; never accepted as an alias.
    const obsolete = "b4ce8d19a3f5cf6e8c148c4b62243e4b077898bf19b353451e1af16e41708d0b";
    expect(migrationChecksum(mleConceptCatalogMigration)).not.toBe(obsolete);
    sqlite.prepare("UPDATE schema_migrations SET checksum=? WHERE migration_id='MIG-0018'").run(obsolete);
    expect(new DatabaseMigrationPreflight(db).inspect()).toMatchObject({ status: "BLOCKED", schemaState: "CHECKSUM_MISMATCH", blockers: ["MIGRATION_CHECKSUM_MISMATCH"] });
    sqlite.prepare("UPDATE schema_migrations SET checksum=? WHERE migration_id='MIG-0018'").run(migrationChecksum(mleConceptCatalogMigration));
    sqlite.exec("DROP INDEX mle_source_versions_identity");
    expect(() => assertMleCatalogSchema(db)).toThrow();
  });
});
