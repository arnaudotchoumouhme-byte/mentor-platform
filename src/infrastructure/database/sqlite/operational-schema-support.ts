import { coreMigrationRegistry } from "./migrations/core-migration-registry";

export const MAX_SUPPORTED_SCHEMA_VERSION = coreMigrationRegistry.currentVersion;

export function isMcqImportSchemaSupported(version: number | null): boolean {
  return version !== null && version >= 14 && version <= MAX_SUPPORTED_SCHEMA_VERSION;
}

export function isSourceVersionAliasSchemaSupported(version: number | null): boolean {
  return version !== null && version >= 15 && version <= MAX_SUPPORTED_SCHEMA_VERSION;
}
