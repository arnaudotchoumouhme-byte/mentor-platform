import type { DatabaseSchemaSnapshot } from "./schema-snapshot";
import { MIGRATION_HISTORY_TABLE } from "./sqlite-migration-history-store";

export type DatabaseFreshness =
  | "FRESH"
  | "NON_EMPTY_UNVERSIONED"
  | "VERSIONED"
  | "INCONSISTENT_MIGRATION_METADATA";

const REQUIRED_HISTORY_COLUMNS = [
  ["migration_id", "TEXT", true, 1],
  ["from_version", "INTEGER", false, 0],
  ["to_version", "INTEGER", false, 0],
  ["description", "TEXT", false, 0],
  ["checksum", "TEXT", false, 0],
  ["applied_at", "TEXT", false, 0],
  ["duration_ms", "INTEGER", false, 0],
  ["application_kind", "TEXT", false, 0],
  ["application_version", "TEXT", true, 0],
] as const;

function validHistoryTable(
  history: DatabaseSchemaSnapshot["tables"][number],
): boolean {
  const columnsValid =
    history.columns.length === REQUIRED_HISTORY_COLUMNS.length &&
    REQUIRED_HISTORY_COLUMNS.every(
      ([name, type, nullable, primaryKeyPosition], index) => {
        const column = history.columns[index];
        return (
          column?.name === name &&
          column.declaredType === type &&
          column.nullable === nullable &&
          column.primaryKeyPosition === primaryKeyPosition
        );
      },
    );
  const uniqueKeyColumns = history.indexes
    .filter((index) => index.unique)
    .flatMap((index) =>
      index.columns.filter((column) => column.key).map((column) => column.name),
    );
  return (
    columnsValid &&
    uniqueKeyColumns.includes("migration_id") &&
    uniqueKeyColumns.includes("to_version")
  );
}

export function detectDatabaseFreshness(
  snapshot: DatabaseSchemaSnapshot,
): DatabaseFreshness {
  const nonInternalTables = snapshot.tables.filter(
    (table) => table.kind !== "SQLITE_INTERNAL",
  );
  const history = nonInternalTables.find(
    (table) => table.name === MIGRATION_HISTORY_TABLE,
  );

  if (history) {
    return validHistoryTable(history)
      ? "VERSIONED"
      : "INCONSISTENT_MIGRATION_METADATA";
  }

  return nonInternalTables.length === 0 &&
    snapshot.views.length === 0 &&
    snapshot.triggers.length === 0
    ? "FRESH"
    : "NON_EMPTY_UNVERSIONED";
}
