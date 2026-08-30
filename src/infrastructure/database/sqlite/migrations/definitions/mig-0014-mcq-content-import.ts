import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";
import { SqliteSchemaInspector } from "../sqlite-schema-inspector";

export const MCQ_CONTENT_TABLE_NAMES = ["mcq_item_editorial_metadata"] as const;
export const MCQ_CONTENT_STATEMENTS = [
  `CREATE TABLE mcq_item_editorial_metadata (
    item_id TEXT NOT NULL,
    item_version INTEGER NOT NULL CHECK(item_version >= 1),
    editorial_status TEXT NOT NULL CHECK(editorial_status IN ('DRAFT','IN_REVIEW','PUBLISHED','RETIRED')),
    source_version_id TEXT NOT NULL,
    reference_type TEXT NOT NULL CHECK(reference_type IN ('PAGE','SECTION','URL','DOCUMENT')),
    reference_locator TEXT NOT NULL,
    reference_label TEXT NOT NULL,
    corpus_id TEXT NOT NULL,
    corpus_version INTEGER NOT NULL CHECK(corpus_version >= 1),
    content_checksum TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    PRIMARY KEY(item_id,item_version),
    FOREIGN KEY(item_id,item_version) REFERENCES mcq_question_versions(item_id,version) ON DELETE RESTRICT,
    FOREIGN KEY(source_version_id) REFERENCES source_versions(source_version_id) ON DELETE RESTRICT
  )`,
  "CREATE INDEX mcq_editorial_status_lookup ON mcq_item_editorial_metadata(editorial_status,item_id,item_version)",
  "CREATE INDEX mcq_editorial_source_lookup ON mcq_item_editorial_metadata(source_version_id,item_id,item_version)",
] as const;

export function assertMcqContentSchema(database: SqliteExecutor): void {
  const table = new SqliteSchemaInspector(database).inspect().tables.find(item => item.name === "mcq_item_editorial_metadata");
  const targets = new Set(table?.foreignKeys.map(key => key.targetTable));
  const indexes = new Set(table?.indexes.map(index => index.name));
  if (!table || !targets.has("mcq_question_versions") || !targets.has("source_versions") || !indexes.has("mcq_editorial_status_lookup") || !indexes.has("mcq_editorial_source_lookup")) {
    throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "MCQ content import schema is incomplete.");
  }
}

export const mcqContentImportMigration = {
  id: "MIG-0014",
  fromVersion: 13,
  toVersion: 14,
  description: "Add sourced editorial metadata for versioned MCQ content",
  checksumMaterial: [...MCQ_CONTENT_STATEMENTS, "postcondition:mcq-content-import-v1"],
  up: (database: SqliteExecutor): void => { for (const statement of MCQ_CONTENT_STATEMENTS) database.run(statement); },
  validate: assertMcqContentSchema,
} as const;
