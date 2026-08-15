import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";
import { SqliteSchemaInspector } from "../sqlite-schema-inspector";

export const QUEBEC_PRACTICE_STATEMENTS = [
  `CREATE TABLE canadian_practice_rule_versions_v9 (
    practice_rule_version_id TEXT PRIMARY KEY,
    practice_rule_id TEXT NOT NULL,
    rule_version INTEGER NOT NULL CHECK(rule_version >= 1),
    jurisdiction TEXT NOT NULL CHECK(jurisdiction IN ('FEDERAL','PROVINCIAL')),
    province TEXT CHECK(province IS NULL OR province IN ('ON','QC')),
    source_version_id TEXT NOT NULL,
    verified_at TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    status TEXT NOT NULL CHECK(status IN ('DRAFT','ACTIVE','RETIRED')),
    pedagogical_summary TEXT NOT NULL CHECK(length(trim(pedagogical_summary)) > 0),
    independence_disclaimer TEXT NOT NULL CHECK(length(trim(independence_disclaimer)) > 0),
    created_at TEXT NOT NULL,
    UNIQUE(practice_rule_id,rule_version),
    CHECK((jurisdiction='FEDERAL' AND province IS NULL) OR (jurisdiction='PROVINCIAL' AND province IN ('ON','QC'))),
    CHECK(effective_to IS NULL OR effective_to > effective_from),
    FOREIGN KEY(practice_rule_id) REFERENCES canadian_practice_rules(practice_rule_id) ON DELETE RESTRICT,
    FOREIGN KEY(source_version_id) REFERENCES source_versions(source_version_id) ON DELETE RESTRICT
  )`,
  `INSERT INTO canadian_practice_rule_versions_v9(
    practice_rule_version_id,practice_rule_id,rule_version,jurisdiction,province,source_version_id,
    verified_at,effective_from,effective_to,status,pedagogical_summary,independence_disclaimer,created_at
  ) SELECT practice_rule_version_id,practice_rule_id,rule_version,jurisdiction,province,source_version_id,
    verified_at,effective_from,effective_to,status,pedagogical_summary,independence_disclaimer,created_at
    FROM canadian_practice_rule_versions`,
  "DROP TABLE canadian_practice_rule_versions",
  "ALTER TABLE canadian_practice_rule_versions_v9 RENAME TO canadian_practice_rule_versions",
  "CREATE INDEX canadian_practice_rule_versions_resolution ON canadian_practice_rule_versions(practice_rule_id,jurisdiction,province,status,effective_from,effective_to)",
  "CREATE INDEX canadian_practice_rule_versions_source ON canadian_practice_rule_versions(source_version_id)",
] as const;

export function assertQuebecPracticeSchema(database: SqliteExecutor): void {
  const table = new SqliteSchemaInspector(database).inspect().tables.find(({ name }) => name === "canadian_practice_rule_versions");
  if (!table || !table.definitionSql.includes("'QC'") || table.foreignKeys.length !== 2 || !table.indexes.some(({ name }) => name === "canadian_practice_rule_versions_resolution") || !table.indexes.some(({ name }) => name === "canadian_practice_rule_versions_source")) throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "Quebec Practice schema is incomplete.");
}

export const quebecPracticeExtensionMigration = { id: "MIG-0009", fromVersion: 8, toVersion: 9, description: "Allow Quebec Canadian Practice rule versions", checksumMaterial: [...QUEBEC_PRACTICE_STATEMENTS, "postcondition:quebec-practice-extension-v1"], up: (database: SqliteExecutor) => { for (const statement of QUEBEC_PRACTICE_STATEMENTS) database.run(statement); }, validate: assertQuebecPracticeSchema } as const;
