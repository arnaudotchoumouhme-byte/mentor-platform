import { migrationChecksum } from "./migration-checksum";
import type { AppliedMigration } from "./migration-history-store";
import { MigrationError } from "./migration-errors";
import type { MigrationRegistry } from "./migration-registry";

export function validateMigrationHistory(
  history: readonly AppliedMigration[],
  registry: MigrationRegistry,
): void {
  const ids = new Set<string>();
  const versions = new Set<number>();
  let expectedSource = 0;

  for (const applied of history) {
    if (ids.has(applied.migrationId) || versions.has(applied.toVersion)) {
      throw new MigrationError(
        "INVALID_MIGRATION_HISTORY",
        "Migration history contains duplicate identities or target versions.",
      );
    }
    ids.add(applied.migrationId);
    versions.add(applied.toVersion);

    if (applied.toVersion > registry.currentVersion) {
      throw new MigrationError(
        "MIGRATION_HISTORY_AHEAD",
        `Stored migration version ${applied.toVersion} is ahead of registry version ${registry.currentVersion}.`,
      );
    }

    const known = registry.findById(applied.migrationId);
    if (!known) {
      throw new MigrationError(
        "UNKNOWN_APPLIED_MIGRATION",
        `Stored migration ${applied.migrationId} is unknown to this application.`,
      );
    }
    if (
      known.fromVersion !== applied.fromVersion ||
      known.toVersion !== applied.toVersion ||
      known.description !== applied.description ||
      applied.fromVersion !== expectedSource ||
      applied.toVersion !== expectedSource + 1
    ) {
      throw new MigrationError(
        "INVALID_MIGRATION_HISTORY",
        `Stored migration ${applied.migrationId} does not form the expected version chain.`,
      );
    }
    if (migrationChecksum(known) !== applied.checksum) {
      throw new MigrationError(
        "MIGRATION_CHECKSUM_MISMATCH",
        `Stored migration ${applied.migrationId} does not match its immutable definition.`,
      );
    }
    expectedSource = applied.toVersion;
  }
}
