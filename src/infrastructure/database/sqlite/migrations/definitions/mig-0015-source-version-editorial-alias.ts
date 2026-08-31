import type { SqliteExecutor, SqliteParameter } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";

export const SOURCE_VERSION_EDITORIAL_ALIAS_TABLE_NAMES = ["source_version_editorial_aliases"] as const;
export const SOURCE_VERSION_EDITORIAL_ALIAS_TRIGGER_NAMES = ["source_version_editorial_aliases_no_update", "source_version_editorial_aliases_no_delete"] as const;

export function withoutSourceVersionEditorialAliasTriggers(database: SqliteExecutor): SqliteExecutor {
  return {
    run: (sql, ...params) => database.run(sql, ...params),
    all: <T>(sql: string, ...params: SqliteParameter[]) => {
      const rows = database.all<Record<string, unknown>>(sql, ...params);
      if (!sql.includes("FROM sqlite_master") || !sql.includes("'trigger'")) return rows as T[];
      return rows.filter(row => row.type !== "trigger" || !SOURCE_VERSION_EDITORIAL_ALIAS_TRIGGER_NAMES.includes(row.name as typeof SOURCE_VERSION_EDITORIAL_ALIAS_TRIGGER_NAMES[number])) as T[];
    },
  };
}
export const SOURCE_VERSION_EDITORIAL_ALIAS_STATEMENTS = [
  `CREATE TABLE source_version_editorial_aliases (
    alias_id TEXT PRIMARY KEY,
    editorial_alias TEXT NOT NULL UNIQUE COLLATE BINARY CHECK(length(editorial_alias) BETWEEN 4 AND 103 AND editorial_alias NOT GLOB '*[^A-Z0-9/-]*' AND instr(editorial_alias,'/V') > 1),
    source_version_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    provenance TEXT NOT NULL CHECK(provenance='MANUAL_EDITORIAL_ASSOCIATION'),
    FOREIGN KEY(source_version_id) REFERENCES source_versions(source_version_id) ON DELETE RESTRICT
  )`,
  `CREATE TRIGGER source_version_editorial_aliases_no_update BEFORE UPDATE ON source_version_editorial_aliases BEGIN SELECT RAISE(ABORT,'SOURCE_EDITORIAL_ALIAS_IMMUTABLE'); END`,
  `CREATE TRIGGER source_version_editorial_aliases_no_delete BEFORE DELETE ON source_version_editorial_aliases BEGIN SELECT RAISE(ABORT,'SOURCE_EDITORIAL_ALIAS_IMMUTABLE'); END`,
] as const;

export function assertSourceVersionEditorialAliasSchema(database: SqliteExecutor): void {
  const table = database.all<{ name: string }>("SELECT name FROM sqlite_schema WHERE type='table' AND name='source_version_editorial_aliases'")[0];
  const fk = database.all<{ target_table: string; from_column: string; on_delete: string }>(`SELECT "table" AS target_table,"from" AS from_column,on_delete FROM pragma_foreign_key_list('source_version_editorial_aliases')`).find(key => key.from_column === "source_version_id");
  const uniqueIndexes = database.all<{ name: string }>("SELECT name FROM pragma_index_list('source_version_editorial_aliases') WHERE \"unique\"=1");
  const uniqueColumns = new Set(uniqueIndexes.flatMap(index => database.all<{ name: string | null }>("SELECT name FROM pragma_index_info(?)", index.name).map(column => column.name)));
  const triggers = new Set(database.all<{ name: string }>("SELECT name FROM sqlite_schema WHERE type='trigger' AND tbl_name='source_version_editorial_aliases'").map(trigger => trigger.name));
  if (!table || fk?.target_table !== "source_versions" || fk.on_delete !== "RESTRICT" || !uniqueColumns.has("editorial_alias") || !uniqueColumns.has("source_version_id") || SOURCE_VERSION_EDITORIAL_ALIAS_TRIGGER_NAMES.some(name => !triggers.has(name))) {
    throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "Source version editorial alias schema is incomplete.");
  }
}

export const sourceVersionEditorialAliasMigration = {
  id: "MIG-0015",
  fromVersion: 14,
  toVersion: 15,
  description: "Add immutable editorial aliases for source versions",
  checksumMaterial: [...SOURCE_VERSION_EDITORIAL_ALIAS_STATEMENTS, "postcondition:source-version-editorial-alias-v1"],
  up: (database: SqliteExecutor): void => { for (const statement of SOURCE_VERSION_EDITORIAL_ALIAS_STATEMENTS) database.run(statement); },
  validate: assertSourceVersionEditorialAliasSchema,
} as const;
