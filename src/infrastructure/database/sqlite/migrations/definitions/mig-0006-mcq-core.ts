import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";
import { SqliteSchemaInspector } from "../sqlite-schema-inspector";

export const MCQ_CORE_TABLE_NAMES = ["mcq_answers", "mcq_item_mappings", "mcq_question_items", "mcq_question_versions", "mcq_session_items", "mcq_sessions"] as const;
export const MCQ_CORE_STATEMENTS = [
  `CREATE TABLE mcq_question_items (
    item_id TEXT PRIMARY KEY, latest_version INTEGER NOT NULL CHECK(latest_version >= 1),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE mcq_question_versions (
    item_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version >= 1), stem TEXT NOT NULL,
    choices_json TEXT NOT NULL, correct_choice_id TEXT NOT NULL, explanation TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK(difficulty IN ('FOUNDATION','INTERMEDIATE','ADVANCED')),
    provenance TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(item_id,version), FOREIGN KEY(item_id) REFERENCES mcq_question_items(item_id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE mcq_item_mappings (
    item_id TEXT NOT NULL, item_version INTEGER NOT NULL, blueprint_version_id TEXT NOT NULL,
    domain_id TEXT NOT NULL, competency_id TEXT NOT NULL, topic_id TEXT NOT NULL, objective_id TEXT NOT NULL,
    PRIMARY KEY(item_id,item_version,blueprint_version_id,domain_id,competency_id,topic_id,objective_id),
    FOREIGN KEY(item_id,item_version) REFERENCES mcq_question_versions(item_id,version) ON DELETE RESTRICT
  )`,
  "CREATE INDEX mcq_item_mappings_blueprint ON mcq_item_mappings(blueprint_version_id,domain_id,competency_id,topic_id)",
  `CREATE TABLE mcq_sessions (
    session_id TEXT PRIMARY KEY, mode TEXT NOT NULL CHECK(mode IN ('STUDY','QUIZ')),
    status TEXT NOT NULL CHECK(status IN ('IN_PROGRESS','COMPLETED')), blueprint_version_id TEXT NOT NULL,
    seed TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT,
    total_count INTEGER, answered_count INTEGER, correct_count INTEGER, incorrect_count INTEGER,
    unanswered_count INTEGER, percentage REAL, score_json TEXT,
    CHECK((status='IN_PROGRESS' AND completed_at IS NULL) OR (status='COMPLETED' AND completed_at IS NOT NULL))
  )`,
  "CREATE INDEX mcq_sessions_status ON mcq_sessions(status,started_at)",
  `CREATE TABLE mcq_session_items (
    session_id TEXT NOT NULL, position INTEGER NOT NULL CHECK(position >= 0), item_id TEXT NOT NULL, item_version INTEGER NOT NULL,
    PRIMARY KEY(session_id,position), UNIQUE(session_id,item_id,item_version),
    FOREIGN KEY(session_id) REFERENCES mcq_sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY(item_id,item_version) REFERENCES mcq_question_versions(item_id,version) ON DELETE RESTRICT
  )`,
  `CREATE TABLE mcq_answers (
    session_id TEXT NOT NULL, item_id TEXT NOT NULL, item_version INTEGER NOT NULL, choice_id TEXT NOT NULL,
    correct INTEGER NOT NULL CHECK(correct IN (0,1)), duration_ms INTEGER CHECK(duration_ms IS NULL OR duration_ms >= 0),
    error_classification TEXT, answered_at TEXT NOT NULL,
    PRIMARY KEY(session_id,item_id,item_version),
    FOREIGN KEY(session_id,item_id,item_version) REFERENCES mcq_session_items(session_id,item_id,item_version) ON DELETE CASCADE
  )`,
  "CREATE INDEX mcq_answers_session ON mcq_answers(session_id,answered_at)",
] as const;

export function assertMcqCoreSchema(database: SqliteExecutor): void {
  const snapshot = new SqliteSchemaInspector(database).inspect();
  const names = new Set(snapshot.tables.map(({ name }) => name));
  if (MCQ_CORE_TABLE_NAMES.some((name) => !names.has(name))) throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "MCQ Core schema is incomplete.");
  const versions = snapshot.tables.find(({ name }) => name === "mcq_question_versions");
  const mappings = snapshot.tables.find(({ name }) => name === "mcq_item_mappings");
  const sessionItems = snapshot.tables.find(({ name }) => name === "mcq_session_items");
  const answers = snapshot.tables.find(({ name }) => name === "mcq_answers");
  const targets = (table: typeof versions) => new Set(table?.foreignKeys.map(({ targetTable }) => targetTable));
  if (!versions || !targets(versions).has("mcq_question_items") || !mappings || !targets(mappings).has("mcq_question_versions") || !sessionItems || !targets(sessionItems).has("mcq_sessions") || !targets(sessionItems).has("mcq_question_versions") || !answers || !targets(answers).has("mcq_session_items")) throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "MCQ Core relational constraints are incomplete.");
}

export const mcqCoreMigration = { id: "MIG-0006", fromVersion: 5, toVersion: 6, description: "Create versioned MCQ items, sessions and answers", checksumMaterial: [...MCQ_CORE_STATEMENTS, "postcondition:mcq-core-v1"], up: (database: SqliteExecutor) => { for (const statement of MCQ_CORE_STATEMENTS) database.run(statement); }, validate: assertMcqCoreSchema } as const;
