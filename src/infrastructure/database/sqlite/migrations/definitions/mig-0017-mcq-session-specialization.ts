import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";

export const MCQ_SESSION_SPECIALIZATION_STATEMENTS = [
  "ALTER TABLE mcq_sessions ADD COLUMN session_kind TEXT CHECK(session_kind IN ('STANDARD','MOCK_EXAM'))",
  "ALTER TABLE mcq_sessions ADD COLUMN duration_seconds INTEGER CHECK(duration_seconds IS NULL OR (typeof(duration_seconds) = 'integer' AND duration_seconds > 0))",
] as const;

export function assertMcqSessionSpecializationSchema(database: SqliteExecutor): void {
  const columns = new Map(
    database
      .all<{ name: string; type: string; notnull: number }>("PRAGMA table_info('mcq_sessions')")
      .map(column => [column.name, column]),
  );
  const sessionKind = columns.get("session_kind");
  const durationSeconds = columns.get("duration_seconds");
  const tableSql = database.all<{ sql: string }>(
    "SELECT sql FROM sqlite_schema WHERE type='table' AND name='mcq_sessions'",
  )[0]?.sql ?? "";

  if (
    sessionKind?.type !== "TEXT" ||
    sessionKind.notnull !== 0 ||
    durationSeconds?.type !== "INTEGER" ||
    durationSeconds.notnull !== 0 ||
    !tableSql.includes("session_kind IN ('STANDARD','MOCK_EXAM')") ||
    !tableSql.includes("duration_seconds IS NULL OR (typeof(duration_seconds) = 'integer' AND duration_seconds > 0)")
  ) {
    throw new MigrationError(
      "MIGRATION_SCHEMA_POSTCONDITION_FAILED",
      "MCQ session specialization schema is incomplete.",
    );
  }
}

export const mcqSessionSpecializationMigration = {
  id: "MIG-0017",
  fromVersion: 16,
  toVersion: 17,
  description: "Add durable MCQ session kind and optional duration",
  checksumMaterial: [
    ...MCQ_SESSION_SPECIALIZATION_STATEMENTS,
    "postcondition:mcq-session-specialization-v1",
  ],
  up: (database: SqliteExecutor): void => {
    for (const statement of MCQ_SESSION_SPECIALIZATION_STATEMENTS) database.run(statement);
  },
  validate: assertMcqSessionSpecializationSchema,
} as const;
