import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";

export const LEARNER_OWNERSHIP_TABLES = [
  "learner_document_ownership",
  "learner_flashcard_ownership",
  "learner_attempt_ownership",
  "learner_weakness_ownership",
  "learner_study_task_ownership",
  "learner_conversation_ownership",
  "learner_coaching_session_ownership",
  "learner_settings",
] as const;

export const LEARNER_DATA_ISOLATION_STATEMENTS = [
  `CREATE TABLE learner_document_ownership (document_id INTEGER PRIMARY KEY, learner_id TEXT NOT NULL, FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE, FOREIGN KEY(learner_id) REFERENCES accounts(learner_id) ON DELETE RESTRICT)`,
  `CREATE INDEX learner_documents_by_learner ON learner_document_ownership(learner_id,document_id)`,
  `CREATE TABLE learner_flashcard_ownership (flashcard_id INTEGER PRIMARY KEY, learner_id TEXT NOT NULL, FOREIGN KEY(flashcard_id) REFERENCES flashcards(id) ON DELETE CASCADE, FOREIGN KEY(learner_id) REFERENCES accounts(learner_id) ON DELETE RESTRICT)`,
  `CREATE INDEX learner_flashcards_by_learner ON learner_flashcard_ownership(learner_id,flashcard_id)`,
  `CREATE TABLE learner_attempt_ownership (attempt_id INTEGER PRIMARY KEY, learner_id TEXT NOT NULL, FOREIGN KEY(attempt_id) REFERENCES attempts(id) ON DELETE CASCADE, FOREIGN KEY(learner_id) REFERENCES accounts(learner_id) ON DELETE RESTRICT)`,
  `CREATE INDEX learner_attempts_by_learner ON learner_attempt_ownership(learner_id,attempt_id)`,
  `CREATE TABLE learner_weakness_ownership (weakness_id INTEGER PRIMARY KEY, learner_id TEXT NOT NULL, FOREIGN KEY(weakness_id) REFERENCES weaknesses(id) ON DELETE CASCADE, FOREIGN KEY(learner_id) REFERENCES accounts(learner_id) ON DELETE RESTRICT)`,
  `CREATE INDEX learner_weaknesses_by_learner ON learner_weakness_ownership(learner_id,weakness_id)`,
  `CREATE TABLE learner_study_task_ownership (study_task_id INTEGER PRIMARY KEY, learner_id TEXT NOT NULL, FOREIGN KEY(study_task_id) REFERENCES study_tasks(id) ON DELETE CASCADE, FOREIGN KEY(learner_id) REFERENCES accounts(learner_id) ON DELETE RESTRICT)`,
  `CREATE INDEX learner_study_tasks_by_learner ON learner_study_task_ownership(learner_id,study_task_id)`,
  `CREATE TABLE learner_conversation_ownership (conversation_id INTEGER PRIMARY KEY, learner_id TEXT NOT NULL, FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE, FOREIGN KEY(learner_id) REFERENCES accounts(learner_id) ON DELETE RESTRICT)`,
  `CREATE INDEX learner_conversations_by_learner ON learner_conversation_ownership(learner_id,conversation_id)`,
  `CREATE TABLE learner_coaching_session_ownership (session_id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, FOREIGN KEY(session_id) REFERENCES coaching_sessions(session_id) ON DELETE CASCADE, FOREIGN KEY(learner_id) REFERENCES accounts(learner_id) ON DELETE RESTRICT)`,
  `CREATE INDEX learner_coaching_sessions_by_learner ON learner_coaching_session_ownership(learner_id,session_id)`,
  `CREATE TABLE learner_settings (learner_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(learner_id,key), FOREIGN KEY(learner_id) REFERENCES accounts(learner_id) ON DELETE RESTRICT)`,
] as const;

export function assertLearnerDataIsolationSchema(database: SqliteExecutor): void {
  const tables = new Set(database.all<{ name: string }>("SELECT name FROM sqlite_schema WHERE type='table'").map(row => row.name));
  if (LEARNER_OWNERSHIP_TABLES.some(table => !tables.has(table))) {
    throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "Learner data isolation schema is incomplete.");
  }
  for (const table of LEARNER_OWNERSHIP_TABLES) {
    const foreignKeys = database.all<{ target: string }>(`SELECT "table" AS target FROM pragma_foreign_key_list('${table}')`);
    if (!foreignKeys.some(key => key.target === "accounts")) {
      throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", `Learner ownership table ${table} is not account-bound.`);
    }
  }
}

export const learnerDataIsolationMigration = {
  id: "MIG-0016",
  fromVersion: 15,
  toVersion: 16,
  description: "Add fail-closed learner ownership for pilot private data",
  checksumMaterial: [...LEARNER_DATA_ISOLATION_STATEMENTS, "postcondition:learner-data-isolation-v1"],
  up: (database: SqliteExecutor): void => { for (const statement of LEARNER_DATA_ISOLATION_STATEMENTS) database.run(statement); },
  validate: assertLearnerDataIsolationSchema,
} as const;
