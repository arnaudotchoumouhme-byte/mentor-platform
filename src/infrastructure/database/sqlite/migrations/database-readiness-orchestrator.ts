import type { SqliteExecutor } from "../sqlite-executor";
import { coreMigrationRegistry } from "./core-migration-registry";
import { detectDatabaseFreshness } from "./fresh-database-detector";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { LegacyBaselineAdopter } from "./legacy-baseline-adopter";
import { LegacySchemaRecognizer } from "./legacy-schema-recognizer";
import { MigrationError, type MigrationErrorCode } from "./migration-errors";
import { validateMigrationHistory } from "./migration-history-validation";
import type { MigrationRegistry } from "./migration-registry";
import { SqliteMigrationHistoryStore } from "./sqlite-migration-history-store";
import { SqliteSchemaInspector } from "./sqlite-schema-inspector";

export type DatabaseStartupState =
  | "FRESH"
  | "LEGACY_RECOGNIZED"
  | "LEGACY_PARTIAL"
  | "LEGACY_AMBIGUOUS"
  | "LEGACY_UNKNOWN"
  | "VERSIONED_CURRENT"
  | "VERSIONED_OUTDATED"
  | "VERSIONED_AHEAD"
  | "INVALID_HISTORY"
  | "CHECKSUM_MISMATCH"
  | "SCHEMA_INCOMPATIBLE"
  | "MIGRATION_FAILED";

export type DatabaseReadinessAction =
  | "BOOTSTRAPPED_FRESH_DATABASE"
  | "ADOPTED_LEGACY_BASELINE"
  | "APPLIED_PENDING_MIGRATIONS"
  | "VALIDATED_CURRENT_DATABASE";

export type DatabaseReadinessResult =
  | Readonly<{
      status: "READY";
      initialState: DatabaseStartupState;
      finalVersion: number;
      actionsPerformed: readonly DatabaseReadinessAction[];
      appliedMigrationIds: readonly string[];
    }>
  | Readonly<{
      status: "BLOCKED";
      initialState: DatabaseStartupState;
      reason: MigrationErrorCode | "DATABASE_NOT_READY";
      safeDiagnostic: string;
    }>;

function stateForFailure(
  code: MigrationErrorCode | "DATABASE_NOT_READY",
  fallback: DatabaseStartupState,
): DatabaseStartupState {
  if (code === "MIGRATION_HISTORY_AHEAD") return "VERSIONED_AHEAD";
  if (code === "MIGRATION_CHECKSUM_MISMATCH") return "CHECKSUM_MISMATCH";
  if (code === "UNKNOWN_LEGACY_SCHEMA") return "LEGACY_UNKNOWN";
  if (code === "PARTIAL_LEGACY_SCHEMA") return "LEGACY_PARTIAL";
  if (code === "AMBIGUOUS_LEGACY_SCHEMA") return "LEGACY_AMBIGUOUS";
  if (
    code === "INVALID_MIGRATION_HISTORY" ||
    code === "UNKNOWN_APPLIED_MIGRATION" ||
    code === "MIGRATION_HISTORY_PERSISTENCE_ERROR"
  ) {
    return "INVALID_HISTORY";
  }
  if (
    code === "IMPORT_JOURNAL_SCHEMA_INCOMPATIBLE" ||
    code === "IMPORT_JOURNAL_SCHEMA_MISSING" ||
    code === "FRESH_BOOTSTRAP_VALIDATION_ERROR" ||
    code === "MIGRATION_SCHEMA_POSTCONDITION_FAILED"
  ) {
    return "SCHEMA_INCOMPATIBLE";
  }
  if (code === "MIGRATION_EXECUTION_ERROR" || code === "LEGACY_ADOPTION_FAILED") {
    return "MIGRATION_FAILED";
  }
  return fallback;
}

function safeFailure(
  cause: unknown,
  fallbackState: DatabaseStartupState,
): DatabaseReadinessResult {
  const reason = cause instanceof MigrationError ? cause.code : "DATABASE_NOT_READY";
  return Object.freeze({
    status: "BLOCKED",
    initialState: stateForFailure(reason, fallbackState),
    reason,
    safeDiagnostic: `Database readiness blocked (${reason}).`,
  });
}

export class DatabaseReadinessOrchestrator {
  private readonly inspector: SqliteSchemaInspector;
  private readonly history: SqliteMigrationHistoryStore;

  constructor(
    private readonly database: SqliteExecutor,
    private readonly registry: MigrationRegistry = coreMigrationRegistry,
    private readonly applicationVersion: string | null = null,
    private readonly recognizer: LegacySchemaRecognizer = new LegacySchemaRecognizer(),
  ) {
    this.inspector = new SqliteSchemaInspector(database);
    this.history = new SqliteMigrationHistoryStore(database);
  }

  ensureReady(): DatabaseReadinessResult {
    let initialState: DatabaseStartupState = "INVALID_HISTORY";
    try {
      const snapshot = this.inspector.inspect();
      const freshness = detectDatabaseFreshness(snapshot);

      if (freshness === "FRESH") {
        initialState = "FRESH";
        const migrated = new FreshDatabaseBootstrap(
          this.database,
          this.registry,
          this.applicationVersion,
        ).run();
        return Object.freeze({
          status: "READY",
          initialState,
          finalVersion: migrated.currentVersion,
          actionsPerformed: Object.freeze([
            "BOOTSTRAPPED_FRESH_DATABASE" as const,
            "APPLIED_PENDING_MIGRATIONS" as const,
          ]),
          appliedMigrationIds: migrated.appliedMigrationIds,
        });
      }

      if (freshness === "VERSIONED") {
        const applied = this.history.list();
        validateMigrationHistory(applied, this.registry);
        const version = applied.at(-1)?.toVersion ?? 0;
        initialState =
          version > this.registry.currentVersion
            ? "VERSIONED_AHEAD"
            : version === this.registry.currentVersion
              ? "VERSIONED_CURRENT"
              : "VERSIONED_OUTDATED";
        const migrated = new FreshDatabaseBootstrap(
          this.database,
          this.registry,
          this.applicationVersion,
        ).run();
        return Object.freeze({
          status: "READY",
          initialState,
          finalVersion: migrated.currentVersion,
          actionsPerformed: Object.freeze(
            migrated.appliedMigrationIds.length
              ? ["APPLIED_PENDING_MIGRATIONS" as const]
              : ["VALIDATED_CURRENT_DATABASE" as const],
          ),
          appliedMigrationIds: migrated.appliedMigrationIds,
        });
      }

      if (freshness === "INCONSISTENT_MIGRATION_METADATA") {
        initialState = "INVALID_HISTORY";
        throw new MigrationError(
          "INVALID_MIGRATION_HISTORY",
          "Migration metadata does not match the canonical history schema.",
        );
      }

      const recognition = this.recognizer.recognize(snapshot);
      if (recognition.state === "PARTIAL_LEGACY") initialState = "LEGACY_PARTIAL";
      else if (recognition.state === "AMBIGUOUS_LEGACY") initialState = "LEGACY_AMBIGUOUS";
      else if (recognition.state === "UNKNOWN_LEGACY") initialState = "LEGACY_UNKNOWN";
      else if (recognition.state === "RECOGNIZED_LEGACY") initialState = "LEGACY_RECOGNIZED";
      else {
        throw new MigrationError(
          "LEGACY_ADOPTION_NOT_ALLOWED",
          `Unexpected unversioned database state ${recognition.state}.`,
        );
      }

      new LegacyBaselineAdopter(
        this.database,
        this.recognizer,
        this.registry,
        this.applicationVersion,
      ).adopt();
      const migrated = new FreshDatabaseBootstrap(
        this.database,
        this.registry,
        this.applicationVersion,
      ).run();
      const actions: DatabaseReadinessAction[] = ["ADOPTED_LEGACY_BASELINE"];
      if (migrated.appliedMigrationIds.length) actions.push("APPLIED_PENDING_MIGRATIONS");
      return Object.freeze({
        status: "READY",
        initialState,
        finalVersion: migrated.currentVersion,
        actionsPerformed: Object.freeze(actions),
        appliedMigrationIds: migrated.appliedMigrationIds,
      });
    } catch (cause) {
      return safeFailure(cause, initialState);
    }
  }
}
