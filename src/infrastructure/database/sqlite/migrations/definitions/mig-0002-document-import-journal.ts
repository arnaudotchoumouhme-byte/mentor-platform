import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";
import { SqliteSchemaInspector } from "../sqlite-schema-inspector";

export const IMPORT_JOURNAL_TABLE = "document_import_journal";
export const IMPORT_JOURNAL_SQL = `CREATE TABLE document_import_journal (
  storage_id TEXT PRIMARY KEY,
  extension TEXT NOT NULL,
  display_name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  subject TEXT NOT NULL,
  document_status TEXT NOT NULL,
  content TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','ready','missing')),
  created_at INTEGER NOT NULL,
  document_id INTEGER
)`;

const EXPECTED_COLUMNS = [
  { name: "storage_id", declaredType: "TEXT", nullable: true, defaultValue: null, primaryKeyPosition: 1 },
  { name: "extension", declaredType: "TEXT", nullable: false, defaultValue: null, primaryKeyPosition: 0 },
  { name: "display_name", declaredType: "TEXT", nullable: false, defaultValue: null, primaryKeyPosition: 0 },
  { name: "media_type", declaredType: "TEXT", nullable: false, defaultValue: null, primaryKeyPosition: 0 },
  { name: "size", declaredType: "INTEGER", nullable: false, defaultValue: null, primaryKeyPosition: 0 },
  { name: "subject", declaredType: "TEXT", nullable: false, defaultValue: null, primaryKeyPosition: 0 },
  { name: "document_status", declaredType: "TEXT", nullable: false, defaultValue: null, primaryKeyPosition: 0 },
  { name: "content", declaredType: "TEXT", nullable: false, defaultValue: null, primaryKeyPosition: 0 },
  { name: "state", declaredType: "TEXT", nullable: false, defaultValue: null, primaryKeyPosition: 0 },
  { name: "created_at", declaredType: "INTEGER", nullable: false, defaultValue: null, primaryKeyPosition: 0 },
  { name: "document_id", declaredType: "INTEGER", nullable: true, defaultValue: null, primaryKeyPosition: 0 },
] as const;

export function assertImportJournalSchema(database: SqliteExecutor): void {
  const table = new SqliteSchemaInspector(database).inspect().tables.find(
    ({ name }) => name === IMPORT_JOURNAL_TABLE,
  );
  if (!table) {
    throw new MigrationError("IMPORT_JOURNAL_SCHEMA_MISSING", "Import journal schema is not ready.");
  }
  const columns = table.columns.map(
    ({ name, declaredType, nullable, defaultValue, primaryKeyPosition }) => ({
      name, declaredType, nullable, defaultValue, primaryKeyPosition,
    }),
  );
  const uniqueColumns = table.indexes
    .filter((index) => index.unique)
    .flatMap((index) => index.columns.filter((column) => column.key).map((column) => column.name));
  const compatible =
    JSON.stringify(columns.slice(0, EXPECTED_COLUMNS.length)) === JSON.stringify(EXPECTED_COLUMNS) &&
    uniqueColumns.includes("storage_id") &&
    table.definitionSql.includes("CHECK(state IN ('pending','ready','missing'))");
  if (!compatible) {
    throw new MigrationError(
      "IMPORT_JOURNAL_SCHEMA_INCOMPATIBLE",
      "Existing import journal schema is incompatible with MIG-0002.",
    );
  }
}

function existingImportJournalIsSatisfied(database: SqliteExecutor): boolean {
  const exists = new SqliteSchemaInspector(database).inspect().tables.some(
    ({ name }) => name === IMPORT_JOURNAL_TABLE,
  );
  if (!exists) return false;
  assertImportJournalSchema(database);
  return true;
}

export const importJournalMigration = {
  id: "MIG-0002",
  fromVersion: 1,
  toVersion: 2,
  description: "Create document import journal",
  checksumMaterial: [IMPORT_JOURNAL_SQL, "postcondition:document-import-journal-v1"],
  up: (database: SqliteExecutor): void => {
    database.run(IMPORT_JOURNAL_SQL);
  },
  isStructurallySatisfied: existingImportJournalIsSatisfied,
  validate: assertImportJournalSchema,
} as const;
