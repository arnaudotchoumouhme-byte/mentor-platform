import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";

export const DOCUMENT_IMPORT_LEARNER_SQL = "ALTER TABLE document_import_journal ADD COLUMN learner_id TEXT REFERENCES accounts(learner_id) ON DELETE RESTRICT";

export const documentImportLearnerMigration = {
  id: "MIG-0020", fromVersion: 19, toVersion: 20,
  description: "Preserve document import learner identity across recovery",
  checksumMaterial: [DOCUMENT_IMPORT_LEARNER_SQL, "postcondition:document-import-learner-v1"],
  up(database: SqliteExecutor) { database.run(DOCUMENT_IMPORT_LEARNER_SQL); },
  validate(database: SqliteExecutor) {
    const columns = database.all<{ name: string; type: string }>("PRAGMA table_info(document_import_journal)");
    const keys = database.all<{ from: string; table: string; to: string }>("PRAGMA foreign_key_list(document_import_journal)");
    if (!columns.some(c => c.name === "learner_id" && c.type === "TEXT") || !keys.some(k => k.from === "learner_id" && k.table === "accounts" && k.to === "learner_id")) {
      throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "Document import learner identity schema is incomplete.");
    }
  },
} as const;
