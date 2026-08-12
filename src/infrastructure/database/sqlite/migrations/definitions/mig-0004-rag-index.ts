import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";
import { SqliteSchemaInspector } from "../sqlite-schema-inspector";

export const RAG_INDEX_STATEMENTS = [
  "ALTER TABLE source_versions ADD COLUMN index_status TEXT NOT NULL DEFAULT 'NOT_INDEXED'",
  `CREATE TABLE document_chunks (
    chunk_id TEXT PRIMARY KEY, source_version_id TEXT NOT NULL, source_id TEXT NOT NULL,
    sequence INTEGER NOT NULL, text TEXT NOT NULL, char_start INTEGER NOT NULL, char_end INTEGER NOT NULL,
    page_start INTEGER, page_end INTEGER, section_title TEXT, heading_path TEXT NOT NULL DEFAULT '[]',
    token_count INTEGER NOT NULL, content_hash TEXT NOT NULL, vector_json TEXT NOT NULL,
    embedding_provider TEXT NOT NULL, index_status TEXT NOT NULL DEFAULT 'INDEXED', language TEXT,
    provenance_type TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_version_id,sequence), FOREIGN KEY(source_version_id) REFERENCES source_versions(source_version_id) ON DELETE CASCADE
  )`,
  "CREATE INDEX document_chunks_source_version ON document_chunks(source_version_id)",
  "CREATE VIRTUAL TABLE document_chunks_fts USING fts5(chunk_id UNINDEXED,text,tokenize='unicode61 remove_diacritics 2')",
] as const;

export function assertRagIndexSchema(database: SqliteExecutor): void {
  const snapshot = new SqliteSchemaInspector(database).inspect();
  const chunks = snapshot.tables.find(({ name }) => name === "document_chunks");
  const versions = snapshot.tables.find(({ name }) => name === "source_versions");
  if (!chunks || !versions?.columns.some(({ name }) => name === "index_status")) {
    throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "RAG index schema is incomplete.");
  }
}

export const ragIndexMigration = {
  id: "MIG-0004", fromVersion: 3, toVersion: 4,
  description: "Create local chunk, lexical and vector index",
  checksumMaterial: [...RAG_INDEX_STATEMENTS, "postcondition:rag-index-v1"],
  up: (database: SqliteExecutor): void => { for (const statement of RAG_INDEX_STATEMENTS) database.run(statement); },
  validate: assertRagIndexSchema,
} as const;
