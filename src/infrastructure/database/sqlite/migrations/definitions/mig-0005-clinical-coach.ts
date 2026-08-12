import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";
import { SqliteSchemaInspector } from "../sqlite-schema-inspector";

export const CLINICAL_COACH_STATEMENTS = [
  `CREATE TABLE coaching_sessions (
    session_id TEXT PRIMARY KEY, mode TEXT NOT NULL, objective_id TEXT NOT NULL, learning_objective TEXT NOT NULL,
    language TEXT NOT NULL, status TEXT NOT NULL, current_step TEXT NOT NULL, learner_level TEXT NOT NULL,
    started_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT, source_scope_json TEXT NOT NULL,
    evidence_refs_json TEXT NOT NULL, current_case_id TEXT, hint_level INTEGER NOT NULL DEFAULT 0,
    attempt_count INTEGER NOT NULL DEFAULT 0, learner_signals_json TEXT NOT NULL DEFAULT '[]',
    learner_answers_json TEXT NOT NULL DEFAULT '[]', pending_teach_back INTEGER NOT NULL DEFAULT 0,
    session_version INTEGER NOT NULL DEFAULT 1, case_json TEXT NOT NULL
  )`,
  `CREATE TABLE coach_learner_signals (
    signal_id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, objective_id TEXT NOT NULL,
    result TEXT NOT NULL, confidence REAL, duration_ms INTEGER NOT NULL, hint_level INTEGER NOT NULL,
    error_type TEXT, safety_signal_missed INTEGER NOT NULL, teachback_result TEXT, transfer_result TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES coaching_sessions(session_id) ON DELETE CASCADE
  )`,
  "CREATE INDEX coach_learner_signals_session ON coach_learner_signals(session_id)",
] as const;

export function assertClinicalCoachSchema(database: SqliteExecutor): void {
  const names = new Set(new SqliteSchemaInspector(database).inspect().tables.map(({ name }) => name));
  if (!names.has("coaching_sessions") || !names.has("coach_learner_signals")) throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "Clinical Coach schema is incomplete.");
}
export const clinicalCoachMigration = { id: "MIG-0005", fromVersion: 4, toVersion: 5, description: "Create persistent Clinical Coach sessions and learner signals", checksumMaterial: [...CLINICAL_COACH_STATEMENTS, "postcondition:clinical-coach-v1"], up: (database: SqliteExecutor) => { for (const statement of CLINICAL_COACH_STATEMENTS) database.run(statement); }, validate: assertClinicalCoachSchema } as const;
