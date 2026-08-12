import { detectDatabaseFreshness } from "./fresh-database-detector";
import { APPROVED_LEGACY_FINGERPRINTS } from "./legacy-schema-fingerprints";
import type {
  LegacySchemaDifference,
  LegacySchemaFingerprint,
  LegacyRecognitionResult,
} from "./legacy-schema-fingerprint";
import type { ColumnSchema, DatabaseSchemaSnapshot, TableSchema } from "./schema-snapshot";

function structuralColumn(column: ColumnSchema) {
  return {
    name: column.name,
    declaredType: column.declaredType,
    nullable: column.nullable,
    defaultValue: column.defaultValue,
    primaryKeyPosition: column.primaryKeyPosition,
  };
}

function compareTable(
  actual: TableSchema,
  expected: LegacySchemaFingerprint["tables"][number],
): LegacySchemaDifference[] {
  const differences: LegacySchemaDifference[] = [];
  const expectedNames = new Set(expected.columns.map(({ name }) => name));
  for (const expectedColumn of expected.columns) {
    const actualColumn = actual.columns.find(({ name }) => name === expectedColumn.name);
    if (!actualColumn) {
      differences.push({ code: "MISSING_COLUMN", table: actual.name, column: expectedColumn.name });
    } else if (JSON.stringify(structuralColumn(actualColumn)) !== JSON.stringify(expectedColumn)) {
      differences.push({
        code: actualColumn.primaryKeyPosition !== expectedColumn.primaryKeyPosition ? "PK_MISMATCH" : "COLUMN_MISMATCH",
        table: actual.name,
        column: expectedColumn.name,
      });
    }
  }
  for (const column of actual.columns) {
    if (!expectedNames.has(column.name)) differences.push({ code: "COLUMN_MISMATCH", table: actual.name, column: column.name });
  }
  for (const uniqueColumn of expected.uniqueColumns) {
    if (!actual.indexes.some((index) => index.unique && index.columns.some((column) => column.key && column.name === uniqueColumn))) {
      differences.push({ code: "INDEX_MISMATCH", table: actual.name, column: uniqueColumn });
    }
  }
  for (const fragment of expected.requiredSqlFragments ?? []) {
    if (!actual.definitionSql.includes(fragment)) differences.push({ code: "CONSTRAINT_MISMATCH", table: actual.name });
  }
  return differences;
}

function compareFingerprint(snapshot: DatabaseSchemaSnapshot, fingerprint: LegacySchemaFingerprint) {
  const actualTables = snapshot.tables.filter(({ kind }) => kind === "APPLICATION_TABLE");
  const expectedNames = new Set(fingerprint.tables.map(({ name }) => name));
  const differences: LegacySchemaDifference[] = [];
  let matchingTables = 0;
  for (const expected of fingerprint.tables) {
    const actual = actualTables.find(({ name }) => name === expected.name);
    if (!actual) differences.push({ code: "MISSING_TABLE", table: expected.name });
    else {
      const tableDifferences = compareTable(actual, expected);
      differences.push(...tableDifferences);
      if (tableDifferences.length === 0) matchingTables += 1;
    }
  }
  for (const actual of actualTables) {
    if (!expectedNames.has(actual.name)) differences.push({ code: "EXTRA_CRITICAL_TABLE", table: actual.name });
  }
  return { differences: Object.freeze(differences), matchingTables };
}

export class LegacySchemaRecognizer {
  constructor(
    private readonly fingerprints: readonly LegacySchemaFingerprint[] = APPROVED_LEGACY_FINGERPRINTS,
  ) {}

  recognize(snapshot: DatabaseSchemaSnapshot): LegacyRecognitionResult {
    const freshness = detectDatabaseFreshness(snapshot);
    if (freshness === "FRESH") return Object.freeze({ state: "FRESH", differences: Object.freeze([]) });
    if (freshness === "VERSIONED" || freshness === "INCONSISTENT_MIGRATION_METADATA") {
      return Object.freeze({
        state: "ALREADY_VERSIONED",
        differences: freshness === "VERSIONED" ? Object.freeze([]) : Object.freeze([{ code: "HISTORY_CONFLICT" as const }]),
      });
    }

    const comparisons = this.fingerprints.map((fingerprint) => ({
      fingerprint,
      ...compareFingerprint(snapshot, fingerprint),
    }));
    const exact = comparisons.filter(({ differences }) => differences.length === 0);
    if (exact.length > 1) {
      return Object.freeze({
        state: "AMBIGUOUS_LEGACY",
        candidateFingerprintIds: Object.freeze(exact.map(({ fingerprint }) => fingerprint.id)),
        differences: Object.freeze([]),
      });
    }
    if (exact.length === 1) {
      return Object.freeze({
        state: "RECOGNIZED_LEGACY",
        matchType: "EXACT_MATCH",
        fingerprint: exact[0].fingerprint,
        differences: Object.freeze([]),
      });
    }
    const candidates = comparisons.filter(({ matchingTables }) => matchingTables > 0);
    if (candidates.length > 0) {
      const bestScore = Math.max(...candidates.map(({ matchingTables }) => matchingTables));
      const best = candidates.filter(({ matchingTables }) => matchingTables === bestScore);
      return Object.freeze({
        state: "PARTIAL_LEGACY",
        candidateFingerprintIds: Object.freeze(best.map(({ fingerprint }) => fingerprint.id)),
        differences: best[0].differences,
      });
    }
    return Object.freeze({ state: "UNKNOWN_LEGACY", differences: Object.freeze([]) });
  }
}
