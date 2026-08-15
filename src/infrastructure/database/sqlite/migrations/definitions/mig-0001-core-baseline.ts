import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";
import { MigrationRegistry } from "../migration-registry";
import { SqliteSchemaInspector } from "../sqlite-schema-inspector";
import type { ColumnSchema, TableSchema } from "../schema-snapshot";
import { importJournalMigration } from "./mig-0002-document-import-journal";
import { sourceModelMigration } from "./mig-0003-source-model";
import { ragIndexMigration } from "./mig-0004-rag-index";
import { clinicalCoachMigration } from "./mig-0005-clinical-coach";
import { mcqCoreMigration } from "./mig-0006-mcq-core";
import { foundationAcademyCoreMigration } from "./mig-0007-foundation-academy-core";
import { canadianPracticeCoreMigration } from "./mig-0008-canadian-practice-core";

export const CORE_BASELINE_TABLE_NAMES = [
  "attempts",
  "conversations",
  "documents",
  "flashcards",
  "questions",
  "settings",
  "study_tasks",
  "subjects",
  "weaknesses",
] as const;

export const CORE_BASELINE_STATEMENTS = [
  `CREATE TABLE subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#177a63',
    mastery INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    subject TEXT NOT NULL DEFAULT 'Non classé',
    status TEXT NOT NULL DEFAULT 'Prêt',
    content TEXT NOT NULL DEFAULT '',
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE flashcards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    subject TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'Moyen',
    due_at TEXT NOT NULL DEFAULT CURRENT_DATE,
    interval_days INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active'
  )`,
  `CREATE TABLE questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT NOT NULL,
    options TEXT NOT NULL,
    answer INTEGER NOT NULL,
    explanation TEXT NOT NULL,
    subject TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    source TEXT NOT NULL
  )`,
  `CREATE TABLE attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    subject TEXT NOT NULL,
    score INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE weaknesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    confidence TEXT NOT NULL,
    cause TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE study_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    task_date TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Moyenne',
    status TEXT NOT NULL DEFAULT 'todo'
  )`,
  `CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    citations TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
] as const;

export type ExpectedColumn = Readonly<
  Pick<ColumnSchema, "name" | "declaredType" | "nullable" | "defaultValue" | "primaryKeyPosition">
>;

const id: ExpectedColumn = {
  name: "id",
  declaredType: "INTEGER",
  nullable: true,
  defaultValue: null,
  primaryKeyPosition: 1,
};
const text = (name: string, defaultValue: string | null = null): ExpectedColumn => ({
  name,
  declaredType: "TEXT",
  nullable: false,
  defaultValue,
  primaryKeyPosition: 0,
});
const integer = (name: string, defaultValue: string | null = null): ExpectedColumn => ({
  name,
  declaredType: "INTEGER",
  nullable: false,
  defaultValue,
  primaryKeyPosition: 0,
});

export const CORE_BASELINE_EXPECTED_COLUMNS: Readonly<Record<string, readonly ExpectedColumn[]>> = {
  subjects: [id, text("name"), text("color", "'#177a63'"), integer("mastery", "0")],
  documents: [
    id, text("name"), text("type"), integer("size", "0"), text("subject", "'Non classé'"),
    text("status", "'Prêt'"), text("content", "''"), integer("archived", "0"),
    text("created_at", "CURRENT_TIMESTAMP"),
  ],
  flashcards: [
    id, text("front"), text("back"), text("subject"), text("difficulty", "'Moyen'"),
    text("due_at", "CURRENT_DATE"), integer("interval_days", "1"), text("status", "'active'"),
  ],
  questions: [
    id, text("prompt"), text("options"), integer("answer"), text("explanation"),
    text("subject"), text("difficulty"), text("source"),
  ],
  attempts: [
    id, text("module"), text("subject"), integer("score"), integer("duration_minutes", "0"),
    text("created_at", "CURRENT_TIMESTAMP"),
  ],
  weaknesses: [
    id, text("subject"), text("topic"), text("confidence"), text("cause"), text("action"),
    text("status", "'active'"), text("updated_at", "CURRENT_TIMESTAMP"),
  ],
  study_tasks: [
    id, text("title"), text("subject"), text("task_date"), integer("minutes"),
    text("priority", "'Moyenne'"), text("status", "'todo'"),
  ],
  conversations: [
    id, text("role"), text("content"), text("citations", "'[]'"),
    text("created_at", "CURRENT_TIMESTAMP"),
  ],
  settings: [
    { name: "key", declaredType: "TEXT", nullable: true, defaultValue: null, primaryKeyPosition: 1 },
    text("value"),
  ],
};

function structuralColumns(table: TableSchema): readonly ExpectedColumn[] {
  return table.columns.map(({ name, declaredType, nullable, defaultValue, primaryKeyPosition }) => ({
    name,
    declaredType,
    nullable,
    defaultValue,
    primaryKeyPosition,
  }));
}

export function assertCoreBaselineSchema(
  database: SqliteExecutor,
  allowedExtraTables: readonly string[] = [],
): void {
  const snapshot = new SqliteSchemaInspector(database).inspect();
  const applicationTables = snapshot.tables.filter(
    (table) => table.kind === "APPLICATION_TABLE",
  );
  const expectedNames = [...CORE_BASELINE_TABLE_NAMES, ...allowedExtraTables].sort();
  const actualNames = applicationTables.map(({ name }) => name);
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new MigrationError(
      "FRESH_BOOTSTRAP_VALIDATION_ERROR",
      "Fresh database does not match the canonical core table set.",
    );
  }

  for (const table of applicationTables) {
    if (allowedExtraTables.includes(table.name)) continue;
    if (
      table.virtual ||
      table.foreignKeys.length !== 0 ||
      JSON.stringify(structuralColumns(table)) !== JSON.stringify(CORE_BASELINE_EXPECTED_COLUMNS[table.name])
    ) {
      throw new MigrationError(
        "FRESH_BOOTSTRAP_VALIDATION_ERROR",
        `Fresh database table ${table.name} does not match the canonical baseline.`,
      );
    }
  }

  const subjects = applicationTables.find(({ name }) => name === "subjects");
  const settings = applicationTables.find(({ name }) => name === "settings");
  const hasUniqueKey = (table: TableSchema | undefined, column: string): boolean =>
    table?.indexes.some(
      (index) => index.unique && index.columns.some((entry) => entry.key && entry.name === column),
    ) ?? false;
  if (!hasUniqueKey(subjects, "name") || !hasUniqueKey(settings, "key")) {
    throw new MigrationError(
      "FRESH_BOOTSTRAP_VALIDATION_ERROR",
      "Fresh database is missing canonical unique indexes.",
    );
  }
  if (snapshot.views.length !== 0 || snapshot.triggers.length !== 0) {
    throw new MigrationError(
      "FRESH_BOOTSTRAP_VALIDATION_ERROR",
      "Fresh database contains unexpected views or triggers.",
    );
  }
}

export const coreBaselineMigration = {
  id: "MIG-0001",
  fromVersion: 0,
  toVersion: 1,
  description: "Create current core schema baseline",
  checksumMaterial: [...CORE_BASELINE_STATEMENTS, "postcondition:core-baseline-v1"],
  up: (database: SqliteExecutor): void => {
    for (const statement of CORE_BASELINE_STATEMENTS) database.run(statement);
  },
  validate: assertCoreBaselineSchema,
} as const;

export const coreMigrationRegistry = new MigrationRegistry([
  coreBaselineMigration,
  importJournalMigration,
  sourceModelMigration,
  ragIndexMigration,
  clinicalCoachMigration,
  mcqCoreMigration,
  foundationAcademyCoreMigration,
  canadianPracticeCoreMigration,
]);
