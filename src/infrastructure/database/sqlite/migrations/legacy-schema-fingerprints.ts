import {
  CORE_BASELINE_EXPECTED_COLUMNS,
  CORE_BASELINE_TABLE_NAMES,
} from "./definitions/mig-0001-core-baseline";
import type {
  LegacySchemaFingerprint,
  LegacyTableFingerprint,
} from "./legacy-schema-fingerprint";

const coreTables: readonly LegacyTableFingerprint[] = CORE_BASELINE_TABLE_NAMES.map(
  (name) =>
    Object.freeze({
      name,
      columns: CORE_BASELINE_EXPECTED_COLUMNS[name],
      uniqueColumns:
        name === "subjects" ? ["name"] : name === "settings" ? ["key"] : [],
    }),
);

export const IMPORT_JOURNAL_FINGERPRINT: LegacyTableFingerprint = Object.freeze({
  name: "document_import_journal",
  columns: [
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
  ],
  uniqueColumns: ["storage_id"],
  requiredSqlFragments: ["CHECK(state IN ('pending','ready','missing'))"],
});

export const LEGACY_CORE_9: LegacySchemaFingerprint = Object.freeze({
  id: "LEGACY_CORE_9",
  description: "Unversioned current core schema without import journal",
  tables: Object.freeze([...coreTables]),
});

export const LEGACY_CORE_9_WITH_IMPORT_JOURNAL: LegacySchemaFingerprint = Object.freeze({
  id: "LEGACY_CORE_9_WITH_IMPORT_JOURNAL",
  description: "Unversioned current core schema with feature-created import journal",
  tables: Object.freeze([...coreTables, IMPORT_JOURNAL_FINGERPRINT].sort((a, b) => a.name.localeCompare(b.name))),
});

export const APPROVED_LEGACY_FINGERPRINTS = Object.freeze([
  LEGACY_CORE_9,
  LEGACY_CORE_9_WITH_IMPORT_JOURNAL,
]);
