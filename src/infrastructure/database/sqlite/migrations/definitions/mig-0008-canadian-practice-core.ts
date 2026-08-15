import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";
import { SqliteSchemaInspector } from "../sqlite-schema-inspector";

export const CANADIAN_PRACTICE_TABLE_NAMES = ["canadian_practice_rule_versions", "canadian_practice_rules"] as const;
export const CANADIAN_PRACTICE_STATEMENTS = [
  `CREATE TABLE canadian_practice_rules (
    practice_rule_id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    learning_objective_id TEXT NOT NULL,
    FOREIGN KEY(learning_objective_id) REFERENCES learning_objectives(learning_objective_id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE canadian_practice_rule_versions (
    practice_rule_version_id TEXT PRIMARY KEY,
    practice_rule_id TEXT NOT NULL,
    rule_version INTEGER NOT NULL CHECK(rule_version >= 1),
    jurisdiction TEXT NOT NULL CHECK(jurisdiction IN ('FEDERAL','PROVINCIAL')),
    province TEXT CHECK(province IS NULL OR province='ON'),
    source_version_id TEXT NOT NULL,
    verified_at TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    status TEXT NOT NULL CHECK(status IN ('DRAFT','ACTIVE','RETIRED')),
    pedagogical_summary TEXT NOT NULL CHECK(length(trim(pedagogical_summary)) > 0),
    independence_disclaimer TEXT NOT NULL CHECK(length(trim(independence_disclaimer)) > 0),
    created_at TEXT NOT NULL,
    UNIQUE(practice_rule_id,rule_version),
    CHECK((jurisdiction='FEDERAL' AND province IS NULL) OR (jurisdiction='PROVINCIAL' AND province='ON')),
    CHECK(effective_to IS NULL OR effective_to > effective_from),
    FOREIGN KEY(practice_rule_id) REFERENCES canadian_practice_rules(practice_rule_id) ON DELETE RESTRICT,
    FOREIGN KEY(source_version_id) REFERENCES source_versions(source_version_id) ON DELETE RESTRICT
  )`,
  "CREATE INDEX canadian_practice_rule_versions_resolution ON canadian_practice_rule_versions(practice_rule_id,jurisdiction,province,status,effective_from,effective_to)",
  "CREATE INDEX canadian_practice_rule_versions_source ON canadian_practice_rule_versions(source_version_id)",
] as const;

export function assertCanadianPracticeCoreSchema(database: SqliteExecutor): void {
  const byName = new Map(new SqliteSchemaInspector(database).inspect().tables.map((table) => [table.name, table]));
  if (CANADIAN_PRACTICE_TABLE_NAMES.some((name) => !byName.has(name))) throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "Canadian Practice schema is incomplete.");
  const versions = byName.get("canadian_practice_rule_versions");
  if (!versions?.indexes.some(({ name }) => name === "canadian_practice_rule_versions_resolution") || !versions.indexes.some(({ name }) => name === "canadian_practice_rule_versions_source") || versions.foreignKeys.length !== 2) throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "Canadian Practice constraints or indexes are incomplete.");
}

export const canadianPracticeCoreMigration = { id: "MIG-0008", fromVersion: 7, toVersion: 8, description: "Create versioned Canadian Practice rules", checksumMaterial: [...CANADIAN_PRACTICE_STATEMENTS, "postcondition:canadian-practice-core-v1"], up: (database: SqliteExecutor) => { for (const statement of CANADIAN_PRACTICE_STATEMENTS) database.run(statement); }, validate: assertCanadianPracticeCoreSchema } as const;
