import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";
import { SqliteSchemaInspector } from "../sqlite-schema-inspector";

export const SOURCE_MODEL_STATEMENTS = [
  `CREATE TABLE sources (
    source_id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'local',
    storage_id TEXT NOT NULL UNIQUE,
    document_id INTEGER NOT NULL UNIQUE,
    original_filename TEXT NOT NULL,
    display_name TEXT NOT NULL,
    media_type TEXT NOT NULL,
    extension TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_type TEXT NOT NULL DEFAULT 'DOCUMENT',
    status TEXT NOT NULL CHECK(status IN ('READY','REQUIRES_OCR','FAILED','DELETED')),
    extraction_status TEXT NOT NULL CHECK(extraction_status IN ('COMPLETED','REQUIRES_OCR','FAILED')),
    version INTEGER NOT NULL DEFAULT 1,
    provenance_type TEXT NOT NULL,
    language TEXT,
    subject TEXT,
    user_notes TEXT,
    page_count INTEGER
  )`,
  `CREATE UNIQUE INDEX sources_user_upload_checksum
    ON sources(workspace_id,checksum)
    WHERE provenance_type='USER_UPLOAD' AND status<>'DELETED'`,
  `CREATE TABLE source_versions (
    source_version_id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    extracted_content TEXT NOT NULL DEFAULT '',
    extraction_status TEXT NOT NULL,
    page_count INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_id,version),
    FOREIGN KEY(source_id) REFERENCES sources(source_id) ON DELETE CASCADE
  )`,
  "ALTER TABLE document_import_journal ADD COLUMN source_id TEXT",
  "ALTER TABLE document_import_journal ADD COLUMN source_version_id TEXT",
  "ALTER TABLE document_import_journal ADD COLUMN original_filename TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE document_import_journal ADD COLUMN checksum TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE document_import_journal ADD COLUMN extraction_status TEXT NOT NULL DEFAULT 'FAILED'",
  "ALTER TABLE document_import_journal ADD COLUMN page_count INTEGER",
] as const;

export function assertSourceModelSchema(database: SqliteExecutor): void {
  const tables = new SqliteSchemaInspector(database).inspect().tables;
  const source = tables.find(({ name }) => name === "sources");
  const versions = tables.find(({ name }) => name === "source_versions");
  const journal = tables.find(({ name }) => name === "document_import_journal");
  const hasColumns = (names: readonly string[], required: readonly string[]) =>
    required.every((name) => names.includes(name));
  if (
    !source || !versions || !journal ||
    !hasColumns(source.columns.map(({ name }) => name), ["source_id", "checksum", "provenance_type", "extraction_status"]) ||
    !hasColumns(versions.columns.map(({ name }) => name), ["source_version_id", "source_id", "extracted_content"]) ||
    !hasColumns(journal.columns.map(({ name }) => name), ["source_id", "source_version_id", "original_filename", "checksum", "extraction_status"])
  ) {
    throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "Source model schema is incomplete.");
  }
}

export const sourceModelMigration = {
  id: "MIG-0003",
  fromVersion: 2,
  toVersion: 3,
  description: "Create source and source version metadata",
  checksumMaterial: [...SOURCE_MODEL_STATEMENTS, "postcondition:source-model-v1"],
  up: (database: SqliteExecutor): void => {
    for (const statement of SOURCE_MODEL_STATEMENTS) database.run(statement);
  },
  validate: assertSourceModelSchema,
} as const;
