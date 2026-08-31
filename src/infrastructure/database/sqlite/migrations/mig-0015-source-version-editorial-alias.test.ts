import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { coreMigrationRegistry } from "./core-migration-registry";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { migrationChecksum } from "./migration-checksum";
import { MigrationRegistry } from "./migration-registry";
import { sourceVersionEditorialAliasMigration, SOURCE_VERSION_EDITORIAL_ALIAS_TRIGGER_NAMES } from "./definitions/mig-0015-source-version-editorial-alias";

const executor = (sqlite: DatabaseSync): SqliteExecutor => ({ all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) });

describe("MIG-0015 source version editorial alias", () => {
  it("migrates a synthetic v14 database additively and preserves data", () => {
    const sqlite = new DatabaseSync(":memory:");
    const database = executor(sqlite);
    const v14 = new MigrationRegistry(coreMigrationRegistry.migrations.filter(migration => !["MIG-0015", "MIG-0016"].includes(migration.id)));
    const v15 = new MigrationRegistry(coreMigrationRegistry.migrations.filter(migration => migration.id !== "MIG-0016"));
    new FreshDatabaseBootstrap(database, v14).run();
    sqlite.prepare("INSERT INTO questions(prompt,options,answer,explanation,subject,difficulty,source) VALUES('legacy','[]',0,'legacy','legacy','legacy','legacy')").run();
    expect(new FreshDatabaseBootstrap(database, v15).run()).toEqual({ currentVersion: 15, appliedMigrationIds: ["MIG-0015"] });
    expect(sqlite.prepare("SELECT prompt FROM questions").get()).toEqual({ prompt: "legacy" });
    expect(sqlite.prepare("SELECT checksum FROM schema_migrations WHERE migration_id='MIG-0015'").get()).toEqual({ checksum: migrationChecksum(sourceVersionEditorialAliasMigration) });
    expect(sqlite.prepare("PRAGMA foreign_key_list(source_version_editorial_aliases)").get()).toMatchObject({ table: "source_versions", from: "source_version_id", on_delete: "RESTRICT" });
    expect(sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='trigger' ORDER BY name").all()).toEqual([...SOURCE_VERSION_EDITORIAL_ALIAS_TRIGGER_NAMES].sort().map(name => ({ name })));
    expect(sqlite.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    sqlite.close();
  });
});
