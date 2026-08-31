import type { SqliteExecutor } from "../sqlite-executor";
import { coreMigrationRegistry } from "./core-migration-registry";
import { assertImportJournalSchema } from "./definitions/mig-0002-document-import-journal";
import { detectDatabaseFreshness } from "./fresh-database-detector";
import { LegacySchemaRecognizer } from "./legacy-schema-recognizer";
import { migrationChecksum } from "./migration-checksum";
import { MigrationError, type MigrationErrorCode } from "./migration-errors";
import { validateMigrationHistory } from "./migration-history-validation";
import type { MigrationRegistry } from "./migration-registry";
import type { DatabaseSchemaSnapshot } from "./schema-snapshot";
import { SqliteMigrationHistoryStore } from "./sqlite-migration-history-store";
import { SqliteSchemaInspector } from "./sqlite-schema-inspector";

export type LegacyAdoptionResult = Readonly<{
  status: "ADOPTED_BASELINE" | "ALREADY_VERSIONED";
  fingerprintId: string | null;
  currentVersion: number;
}>;

function businessStructure(snapshot: DatabaseSchemaSnapshot): string {
  return JSON.stringify({
    tables: snapshot.tables.filter(({ kind }) => kind === "APPLICATION_TABLE"),
    views: snapshot.views,
    triggers: snapshot.triggers,
  });
}

function rejectionCode(state: string): MigrationErrorCode {
  if (state === "PARTIAL_LEGACY") return "PARTIAL_LEGACY_SCHEMA";
  if (state === "AMBIGUOUS_LEGACY") return "AMBIGUOUS_LEGACY_SCHEMA";
  if (state === "UNKNOWN_LEGACY") return "UNKNOWN_LEGACY_SCHEMA";
  return "LEGACY_ADOPTION_NOT_ALLOWED";
}

export class LegacyBaselineAdopter {
  private readonly inspector: SqliteSchemaInspector;
  private readonly history: SqliteMigrationHistoryStore;

  constructor(
    private readonly database: SqliteExecutor,
    private readonly recognizer: LegacySchemaRecognizer = new LegacySchemaRecognizer(),
    private readonly registry: MigrationRegistry = coreMigrationRegistry,
    private readonly applicationVersion: string | null = null,
  ) {
    this.inspector = new SqliteSchemaInspector(database);
    this.history = new SqliteMigrationHistoryStore(database);
  }

  adopt(): LegacyAdoptionResult {
    const initialSnapshot = this.inspector.inspect();
    const recognition = this.recognizer.recognize(initialSnapshot);

    if (recognition.state === "ALREADY_VERSIONED") {
      if (detectDatabaseFreshness(initialSnapshot) !== "VERSIONED") {
        throw new MigrationError(
          "LEGACY_ADOPTION_NOT_ALLOWED",
          "Migration metadata is inconsistent and cannot be adopted.",
        );
      }
      const applied = this.history.list();
      validateMigrationHistory(applied, this.registry);
      return Object.freeze({
        status: "ALREADY_VERSIONED",
        fingerprintId: null,
        currentVersion: applied.at(-1)?.toVersion ?? 0,
      });
    }
    if (recognition.state !== "RECOGNIZED_LEGACY") {
      throw new MigrationError(
        rejectionCode(recognition.state),
        `Legacy baseline adoption refused database state ${recognition.state}.`,
      );
    }

    const fingerprintId = recognition.fingerprint.id;
    const beforeBusinessStructure = businessStructure(initialSnapshot);
    const baseline = this.registry.findById("MIG-0001");
    if (!baseline) {
      throw new MigrationError(
        "LEGACY_ADOPTION_NOT_ALLOWED",
        "Canonical baseline migration MIG-0001 is unavailable.",
      );
    }

    let transactionStarted = false;
    try {
      this.database.run("BEGIN IMMEDIATE");
      transactionStarted = true;
      const lockedSnapshot = this.inspector.inspect();
      const lockedRecognition = this.recognizer.recognize(lockedSnapshot);
      if (
        lockedRecognition.state !== "RECOGNIZED_LEGACY" ||
        lockedRecognition.fingerprint.id !== fingerprintId
      ) {
        throw new MigrationError(
          "LEGACY_SCHEMA_CHANGED_DURING_ADOPTION",
          "Legacy schema changed before baseline adoption could be recorded.",
        );
      }

      this.history.ensureStorage();
      if (this.history.list().length !== 0) {
        throw new MigrationError(
          "LEGACY_ADOPTION_NOT_ALLOWED",
          "Migration history appeared during baseline adoption.",
        );
      }
      this.history.append({
        migrationId: baseline.id,
        fromVersion: baseline.fromVersion,
        toVersion: baseline.toVersion,
        description: baseline.description,
        checksum: migrationChecksum(baseline),
        appliedAt: new Date().toISOString(),
        durationMs: 0,
        applicationKind: "adopted_baseline",
        applicationVersion: this.applicationVersion,
      });
      if (fingerprintId === "LEGACY_CORE_9_WITH_IMPORT_JOURNAL") {
        const journalMigration = this.registry.findById("MIG-0002");
        if (!journalMigration) {
          throw new MigrationError(
            "LEGACY_ADOPTION_NOT_ALLOWED",
            "Canonical import journal migration MIG-0002 is unavailable.",
          );
        }
        assertImportJournalSchema(this.database);
        this.history.append({
          migrationId: journalMigration.id,
          fromVersion: journalMigration.fromVersion,
          toVersion: journalMigration.toVersion,
          description: journalMigration.description,
          checksum: migrationChecksum(journalMigration),
          appliedAt: new Date().toISOString(),
          durationMs: 0,
          applicationKind: "adopted_existing",
          applicationVersion: this.applicationVersion,
        });
      }
      validateMigrationHistory(this.history.list(), this.registry);

      const afterBusinessStructure = businessStructure(this.inspector.inspect());
      if (afterBusinessStructure !== beforeBusinessStructure) {
        throw new MigrationError(
          "LEGACY_SCHEMA_CHANGED_DURING_ADOPTION",
          "Business schema changed during baseline adoption.",
        );
      }
      this.database.run("COMMIT");
    } catch (cause) {
      if (transactionStarted) {
        try {
          this.database.run("ROLLBACK");
        } catch {
          // Preserve the original actionable failure.
        }
      }
      if (
        cause instanceof MigrationError &&
        cause.code !== "MIGRATION_HISTORY_PERSISTENCE_ERROR"
      ) {
        throw cause;
      }
      throw new MigrationError(
        "LEGACY_ADOPTION_FAILED",
        "Legacy baseline adoption failed and migration metadata was rolled back.",
        { cause },
      );
    }

    return Object.freeze({
      status: "ADOPTED_BASELINE",
      fingerprintId,
      currentVersion:
        fingerprintId === "LEGACY_CORE_9_WITH_IMPORT_JOURNAL" ? 2 : baseline.toVersion,
    });
  }
}
