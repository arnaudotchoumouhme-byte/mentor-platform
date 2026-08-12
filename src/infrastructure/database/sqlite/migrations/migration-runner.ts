import type { SqliteExecutor } from "../sqlite-executor";
import { migrationChecksum } from "./migration-checksum";
import { MigrationError } from "./migration-errors";
import { validateMigrationHistory } from "./migration-history-validation";
import type { MigrationHistoryStore } from "./migration-history-store";
import type { MigrationRegistry } from "./migration-registry";

export type MigrationRunResult = Readonly<{
  currentVersion: number;
  appliedMigrationIds: readonly string[];
}>;

export class MigrationRunner {
  constructor(
    private readonly database: SqliteExecutor,
    private readonly history: MigrationHistoryStore,
    private readonly now: () => Date = () => new Date(),
    private readonly monotonicNow: () => number = Date.now,
  ) {}

  runPending(
    registry: MigrationRegistry,
    applicationVersion: string | null = null,
  ): MigrationRunResult {
    const applied = this.history.list();
    validateMigrationHistory(applied, registry);
    let currentVersion = applied.at(-1)?.toVersion ?? 0;
    const appliedMigrationIds: string[] = [];

    for (const migration of registry.migrations) {
      if (migration.toVersion <= currentVersion) continue;
      if (migration.fromVersion !== currentVersion) {
        throw new MigrationError(
          "INVALID_MIGRATION_HISTORY",
          `Migration ${migration.id} cannot follow database version ${currentVersion}.`,
        );
      }

      const startedAt = this.monotonicNow();
      let transactionStarted = false;
      try {
        this.database.run("BEGIN IMMEDIATE");
        transactionStarted = true;
        const structurallySatisfied =
          migration.isStructurallySatisfied?.(this.database) ?? false;
        if (!structurallySatisfied) migration.up(this.database);
        migration.validate?.(this.database);
        this.history.append({
          migrationId: migration.id,
          fromVersion: migration.fromVersion,
          toVersion: migration.toVersion,
          description: migration.description,
          checksum: migrationChecksum(migration),
          appliedAt: this.now().toISOString(),
          durationMs: Math.max(0, Math.round(this.monotonicNow() - startedAt)),
          applicationKind: structurallySatisfied ? "adopted_existing" : "executed",
          applicationVersion,
        });
        this.database.run("COMMIT");
      } catch (cause) {
        if (transactionStarted) {
          try {
            this.database.run("ROLLBACK");
          } catch {
            // The original migration failure is the actionable cause.
          }
        }
        throw new MigrationError(
          "MIGRATION_EXECUTION_ERROR",
          `Migration ${migration.id} failed and was not recorded.`,
          { cause },
        );
      }
      currentVersion = migration.toVersion;
      appliedMigrationIds.push(migration.id);
    }

    return Object.freeze({
      currentVersion,
      appliedMigrationIds: Object.freeze(appliedMigrationIds),
    });
  }
}
