import type { SqliteExecutor } from "../sqlite-executor";
import { MigrationError } from "./migration-errors";
import type {
  AppliedMigration,
  MigrationApplicationKind,
  MigrationHistoryStore,
} from "./migration-history-store";

export const MIGRATION_HISTORY_TABLE = "schema_migrations";

type HistoryRow = Readonly<{
  migration_id: string;
  from_version: number;
  to_version: number;
  description: string;
  checksum: string;
  applied_at: string;
  duration_ms: number;
  application_kind: MigrationApplicationKind;
  application_version: string | null;
}>;

const CREATE_HISTORY_TABLE_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_id TEXT PRIMARY KEY,
  from_version INTEGER NOT NULL CHECK(from_version >= 0),
  to_version INTEGER NOT NULL UNIQUE CHECK(to_version > from_version),
  description TEXT NOT NULL CHECK(length(trim(description)) > 0),
  checksum TEXT NOT NULL CHECK(length(checksum) = 64),
  applied_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK(duration_ms >= 0),
  application_kind TEXT NOT NULL CHECK(application_kind IN ('executed','adopted_baseline','adopted_existing')),
  application_version TEXT
)`;

function toAppliedMigration(row: HistoryRow): AppliedMigration {
  return Object.freeze({
    migrationId: row.migration_id,
    fromVersion: row.from_version,
    toVersion: row.to_version,
    description: row.description,
    checksum: row.checksum,
    appliedAt: row.applied_at,
    durationMs: row.duration_ms,
    applicationKind: row.application_kind,
    applicationVersion: row.application_version,
  });
}

export class SqliteMigrationHistoryStore implements MigrationHistoryStore {
  constructor(private readonly database: SqliteExecutor) {}

  ensureStorage(): void {
    try {
      this.database.run(CREATE_HISTORY_TABLE_SQL);
    } catch (cause) {
      throw new MigrationError(
        "MIGRATION_HISTORY_PERSISTENCE_ERROR",
        "Unable to create migration history storage.",
        { cause },
      );
    }
  }

  list(): readonly AppliedMigration[] {
    try {
      return Object.freeze(
        this.database
          .all<HistoryRow>(
            `SELECT migration_id,from_version,to_version,description,checksum,
                    applied_at,duration_ms,application_kind,application_version
             FROM schema_migrations
             ORDER BY to_version ASC`,
          )
          .map(toAppliedMigration),
      );
    } catch (cause) {
      throw new MigrationError(
        "MIGRATION_HISTORY_PERSISTENCE_ERROR",
        "Unable to read migration history.",
        { cause },
      );
    }
  }

  findById(migrationId: string): AppliedMigration | undefined {
    return this.list().find((migration) => migration.migrationId === migrationId);
  }

  latest(): AppliedMigration | undefined {
    return this.list().at(-1);
  }

  append(migration: AppliedMigration): void {
    if (this.findById(migration.migrationId)) {
      throw new MigrationError(
        "INVALID_MIGRATION_HISTORY",
        `Migration history already contains ${migration.migrationId}.`,
      );
    }
    if (this.list().some((entry) => entry.toVersion === migration.toVersion)) {
      throw new MigrationError(
        "INVALID_MIGRATION_HISTORY",
        `Migration history already contains target version ${migration.toVersion}.`,
      );
    }

    try {
      this.database.run(
        `INSERT INTO schema_migrations (
          migration_id,from_version,to_version,description,checksum,
          applied_at,duration_ms,application_kind,application_version
        ) VALUES (?,?,?,?,?,?,?,?,?)`,
        migration.migrationId,
        migration.fromVersion,
        migration.toVersion,
        migration.description,
        migration.checksum,
        migration.appliedAt,
        migration.durationMs,
        migration.applicationKind,
        migration.applicationVersion,
      );
    } catch (cause) {
      throw new MigrationError(
        "MIGRATION_HISTORY_PERSISTENCE_ERROR",
        `Unable to append migration history for ${migration.migrationId}.`,
        { cause },
      );
    }
  }
}
