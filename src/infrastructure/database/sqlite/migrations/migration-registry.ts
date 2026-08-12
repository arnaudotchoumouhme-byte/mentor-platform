import { migrationChecksum } from "./migration-checksum";
import {
  defineMigration,
  type MigrationDefinition,
} from "./migration-definition";
import { MigrationError } from "./migration-errors";

export class MigrationRegistry {
  readonly migrations: readonly MigrationDefinition[];
  private readonly migrationsById: ReadonlyMap<string, MigrationDefinition>;
  private readonly migrationsByVersion: ReadonlyMap<number, MigrationDefinition>;

  constructor(definitions: readonly MigrationDefinition[]) {
    const migrations = definitions
      .map(defineMigration)
      .sort((left, right) => left.toVersion - right.toVersion);
    const byId = new Map<string, MigrationDefinition>();
    const byVersion = new Map<number, MigrationDefinition>();

    for (const migration of migrations) {
      if (byId.has(migration.id)) {
        throw new MigrationError(
          "DUPLICATE_MIGRATION_ID",
          `Migration ID ${migration.id} is registered more than once.`,
        );
      }
      if (byVersion.has(migration.toVersion)) {
        throw new MigrationError(
          "DUPLICATE_MIGRATION_VERSION",
          `Migration target version ${migration.toVersion} is registered more than once.`,
        );
      }
      byId.set(migration.id, migration);
      byVersion.set(migration.toVersion, migration);
    }

    let expectedSource = 0;
    for (const migration of migrations) {
      if (
        migration.fromVersion !== expectedSource ||
        migration.toVersion !== expectedSource + 1
      ) {
        throw new MigrationError(
          "INVALID_MIGRATION_CHAIN",
          `Migration ${migration.id} must continue the contiguous chain ${expectedSource} -> ${expectedSource + 1}.`,
        );
      }
      migrationChecksum(migration);
      expectedSource = migration.toVersion;
    }

    this.migrations = Object.freeze(migrations);
    this.migrationsById = byId;
    this.migrationsByVersion = byVersion;
    Object.freeze(this);
  }

  get currentVersion(): number {
    return this.migrations.at(-1)?.toVersion ?? 0;
  }

  findById(id: string): MigrationDefinition | undefined {
    return this.migrationsById.get(id);
  }

  findByVersion(version: number): MigrationDefinition | undefined {
    return this.migrationsByVersion.get(version);
  }
}
