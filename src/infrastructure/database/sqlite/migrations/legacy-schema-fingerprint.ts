import type { ExpectedColumn } from "./definitions/mig-0001-core-baseline";

export type LegacyTableFingerprint = Readonly<{
  name: string;
  columns: readonly ExpectedColumn[];
  uniqueColumns: readonly string[];
  requiredSqlFragments?: readonly string[];
}>;

export type LegacySchemaFingerprint = Readonly<{
  id: string;
  description: string;
  tables: readonly LegacyTableFingerprint[];
}>;

export type LegacyDifferenceCode =
  | "MISSING_TABLE"
  | "EXTRA_CRITICAL_TABLE"
  | "MISSING_COLUMN"
  | "COLUMN_MISMATCH"
  | "PK_MISMATCH"
  | "INDEX_MISMATCH"
  | "CONSTRAINT_MISMATCH"
  | "HISTORY_CONFLICT";

export type LegacySchemaDifference = Readonly<{
  code: LegacyDifferenceCode;
  table?: string;
  column?: string;
}>;

export type LegacyRecognitionResult =
  | Readonly<{ state: "FRESH" | "ALREADY_VERSIONED" | "UNKNOWN_LEGACY"; differences: readonly LegacySchemaDifference[] }>
  | Readonly<{ state: "PARTIAL_LEGACY" | "AMBIGUOUS_LEGACY"; differences: readonly LegacySchemaDifference[]; candidateFingerprintIds: readonly string[] }>
  | Readonly<{ state: "RECOGNIZED_LEGACY"; matchType: "EXACT_MATCH" | "COMPATIBLE_MATCH"; fingerprint: LegacySchemaFingerprint; differences: readonly LegacySchemaDifference[] }>;
