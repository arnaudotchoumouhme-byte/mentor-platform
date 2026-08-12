import type { SqliteExecutor } from "../sqlite-executor";
import type { VerifiedBackup } from "../backup/backup-model";
import { assertCoreBaselineSchema, coreMigrationRegistry } from "../migrations/definitions/mig-0001-core-baseline";
import { assertImportJournalSchema } from "../migrations/definitions/mig-0002-document-import-journal";
import { assertSourceModelSchema } from "../migrations/definitions/mig-0003-source-model";
import { assertRagIndexSchema } from "../migrations/definitions/mig-0004-rag-index";
import { assertClinicalCoachSchema } from "../migrations/definitions/mig-0005-clinical-coach";
import { detectDatabaseFreshness } from "../migrations/fresh-database-detector";
import { LegacySchemaRecognizer } from "../migrations/legacy-schema-recognizer";
import { MigrationError } from "../migrations/migration-errors";
import { validateMigrationHistory } from "../migrations/migration-history-validation";
import type { MigrationRegistry } from "../migrations/migration-registry";
import { SqliteMigrationHistoryStore } from "../migrations/sqlite-migration-history-store";
import { SqliteSchemaInspector } from "../migrations/sqlite-schema-inspector";

export type MigrationRiskLevel = "MR0" | "MR1" | "MR2" | "MR3" | "MR4";
export type BackupRequirement =
  | "BACKUP_NOT_REQUIRED"
  | "BACKUP_REQUIRED_MISSING"
  | "BACKUP_REQUIRED_UNVERIFIED"
  | "BACKUP_VERIFIED";

export type MigrationPreflightResult = Readonly<{
  status: "NO_MIGRATION" | "BLOCKED" | "REQUIRES_EXPLICIT_AUTHORIZATION";
  schemaState: string;
  currentVersion: number | null;
  targetVersion: number;
  pendingMigrations: readonly string[];
  riskLevel: MigrationRiskLevel;
  backupRequirement: BackupRequirement;
  migrationAllowed: false;
  explicitConfirmationRequired: boolean;
  integrity: "OK" | "FAILED";
  blockers: readonly string[];
}>;

function blocked(schemaState: string, targetVersion: number, reason: string): MigrationPreflightResult {
  return Object.freeze({
    status: "BLOCKED",
    schemaState,
    currentVersion: null,
    targetVersion,
    pendingMigrations: Object.freeze([]),
    riskLevel: "MR4",
    backupRequirement: "BACKUP_NOT_REQUIRED",
    migrationAllowed: false,
    explicitConfirmationRequired: false,
    integrity: reason === "DATABASE_INTEGRITY_FAILED" ? "FAILED" : "OK",
    blockers: Object.freeze([reason]),
  });
}

function backupRequirement(
  required: boolean,
  evidence: VerifiedBackup | null | "UNVERIFIED",
): BackupRequirement {
  if (!required) return "BACKUP_NOT_REQUIRED";
  if (evidence === null) return "BACKUP_REQUIRED_MISSING";
  if (evidence === "UNVERIFIED") return "BACKUP_REQUIRED_UNVERIFIED";
  return "BACKUP_VERIFIED";
}

export class DatabaseMigrationPreflight {
  constructor(
    private readonly database: SqliteExecutor,
    private readonly registry: MigrationRegistry = coreMigrationRegistry,
    private readonly recognizer: LegacySchemaRecognizer = new LegacySchemaRecognizer(),
  ) {}

  inspect(backupEvidence: VerifiedBackup | null | "UNVERIFIED" = null): MigrationPreflightResult {
    try {
      const integrity = this.database.all<{ integrity_check: string }>("PRAGMA integrity_check");
      if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok") {
        return blocked("CORRUPT_DATABASE", this.registry.currentVersion, "DATABASE_INTEGRITY_FAILED");
      }
      const snapshot = new SqliteSchemaInspector(this.database).inspect();
      const freshness = detectDatabaseFreshness(snapshot);

      if (freshness === "FRESH") {
        return this.actionable("FRESH", 0, "MR1", false, backupEvidence);
      }
      if (freshness === "INCONSISTENT_MIGRATION_METADATA") {
        return blocked("INVALID_HISTORY", this.registry.currentVersion, "INVALID_MIGRATION_HISTORY");
      }
      if (freshness === "VERSIONED") {
        const history = new SqliteMigrationHistoryStore(this.database).list();
        validateMigrationHistory(history, this.registry);
        const version = history.at(-1)?.toVersion ?? 0;
        if (version === this.registry.currentVersion) {
          assertCoreBaselineSchema(this.database, ["coach_learner_signals", "coaching_sessions", "document_chunks", "document_chunks_fts", "document_chunks_fts_config", "document_chunks_fts_content", "document_chunks_fts_data", "document_chunks_fts_docsize", "document_chunks_fts_idx", "document_import_journal", "source_versions", "sources"]);
          assertImportJournalSchema(this.database);
          assertSourceModelSchema(this.database);
          assertRagIndexSchema(this.database);
          assertClinicalCoachSchema(this.database);
          return Object.freeze({
            status: "NO_MIGRATION",
            schemaState: "VERSIONED_CURRENT",
            currentVersion: version,
            targetVersion: this.registry.currentVersion,
            pendingMigrations: Object.freeze([]),
            riskLevel: "MR0",
            backupRequirement: "BACKUP_NOT_REQUIRED",
            migrationAllowed: false,
            explicitConfirmationRequired: false,
            integrity: "OK",
            blockers: Object.freeze([]),
          });
        }
        if (version === 1) assertCoreBaselineSchema(this.database);
        return this.actionable("VERSIONED_OUTDATED", version, "MR3", true, backupEvidence);
      }

      const recognition = this.recognizer.recognize(snapshot);
      if (recognition.state === "RECOGNIZED_LEGACY") {
        return this.actionable("LEGACY_RECOGNIZED", 0, "MR3", true, backupEvidence);
      }
      const state =
        recognition.state === "PARTIAL_LEGACY"
          ? "LEGACY_PARTIAL"
          : recognition.state === "AMBIGUOUS_LEGACY"
            ? "LEGACY_AMBIGUOUS"
            : "LEGACY_UNKNOWN";
      return blocked(state, this.registry.currentVersion, recognition.state);
    } catch (cause) {
      if (cause instanceof MigrationError) {
        const state = cause.code === "MIGRATION_CHECKSUM_MISMATCH"
          ? "CHECKSUM_MISMATCH"
          : cause.code === "MIGRATION_HISTORY_AHEAD"
            ? "VERSIONED_AHEAD"
            : cause.code.includes("IMPORT_JOURNAL")
              ? "SCHEMA_INCOMPATIBLE"
              : "INVALID_HISTORY";
        return blocked(state, this.registry.currentVersion, cause.code);
      }
      const message = cause instanceof Error ? cause.message.toLowerCase() : "";
      if (message.includes("busy") || message.includes("locked")) {
        return blocked("DATABASE_BUSY", this.registry.currentVersion, "DATABASE_BUSY");
      }
      if (
        message.includes("malformed") ||
        message.includes("disk image") ||
        message.includes("not a database")
      ) {
        return blocked("CORRUPT_DATABASE", this.registry.currentVersion, "DATABASE_INTEGRITY_FAILED");
      }
      return blocked("PREFLIGHT_BLOCKED", this.registry.currentVersion, "REAL_DB_PREFLIGHT_BLOCKED");
    }
  }

  private actionable(
    schemaState: string,
    currentVersion: number,
    riskLevel: MigrationRiskLevel,
    backupRequired: boolean,
    evidence: VerifiedBackup | null | "UNVERIFIED",
  ): MigrationPreflightResult {
    const requirement = backupRequirement(backupRequired, evidence);
    const pending = this.registry.migrations
      .filter(({ toVersion }) => toVersion > currentVersion)
      .map(({ id }) => id);
    const blockers = requirement === "BACKUP_REQUIRED_MISSING"
      ? ["MIGRATION_BACKUP_REQUIRED"]
      : requirement === "BACKUP_REQUIRED_UNVERIFIED"
        ? ["BACKUP_VERIFICATION_FAILED"]
        : ["MIGRATION_EXPLICIT_AUTHORIZATION_REQUIRED"];
    return Object.freeze({
      status: requirement === "BACKUP_VERIFIED" || !backupRequired
        ? "REQUIRES_EXPLICIT_AUTHORIZATION"
        : "BLOCKED",
      schemaState,
      currentVersion,
      targetVersion: this.registry.currentVersion,
      pendingMigrations: Object.freeze(pending),
      riskLevel,
      backupRequirement: requirement,
      migrationAllowed: false,
      explicitConfirmationRequired: requirement === "BACKUP_VERIFIED" || !backupRequired,
      integrity: "OK",
      blockers: Object.freeze(blockers),
    });
  }
}

export function inspectDatabaseFileReadOnly(
  databasePath: string,
  backupEvidence: VerifiedBackup | null | "UNVERIFIED" = null,
): MigrationPreflightResult {
  let sqlite: DatabaseSync;
  try {
    sqlite = new DatabaseSync(databasePath, { readOnly: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.toLowerCase() : "";
    const corrupt =
      message.includes("malformed") ||
      message.includes("disk image") ||
      message.includes("not a database");
    return blocked(
      corrupt ? "CORRUPT_DATABASE" : "PREFLIGHT_BLOCKED",
      coreMigrationRegistry.currentVersion,
      corrupt ? "DATABASE_INTEGRITY_FAILED" : "REAL_DB_PREFLIGHT_BLOCKED",
    );
  }
  try {
    sqlite.exec("PRAGMA query_only=ON");
    const executor: SqliteExecutor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
      run: () => {
        throw new Error("Read-only migration preflight cannot execute writes.");
      },
    };
    return new DatabaseMigrationPreflight(executor).inspect(backupEvidence);
  } finally {
    sqlite.close();
  }
}
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
