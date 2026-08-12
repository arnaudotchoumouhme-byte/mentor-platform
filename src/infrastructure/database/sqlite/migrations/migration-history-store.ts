export type MigrationApplicationKind =
  | "executed"
  | "adopted_baseline"
  | "adopted_existing";

export type AppliedMigration = Readonly<{
  migrationId: string;
  fromVersion: number;
  toVersion: number;
  description: string;
  checksum: string;
  appliedAt: string;
  durationMs: number;
  applicationKind: MigrationApplicationKind;
  applicationVersion: string | null;
}>;

export interface MigrationHistoryStore {
  ensureStorage(): void;
  list(): readonly AppliedMigration[];
  findById(migrationId: string): AppliedMigration | undefined;
  latest(): AppliedMigration | undefined;
  append(migration: AppliedMigration): void;
}
