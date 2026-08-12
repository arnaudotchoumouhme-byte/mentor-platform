import type { SqliteExecutor } from "../sqlite-executor";
import { MigrationError } from "./migration-errors";

export const MIGRATION_ID_PATTERN = /^MIG-(\d{4})$/;

export type MigrationOperation = (database: SqliteExecutor) => void;
export type MigrationValidation = (database: SqliteExecutor) => void;

export type MigrationDefinition = Readonly<{
  id: string;
  fromVersion: number;
  toVersion: number;
  description: string;
  checksumMaterial: readonly string[];
  up: MigrationOperation;
  validate?: MigrationValidation;
  isStructurallySatisfied?: (database: SqliteExecutor) => boolean;
}>;

function invalid(message: string): never {
  throw new MigrationError("INVALID_MIGRATION_DEFINITION", message);
}

export function defineMigration(
  definition: MigrationDefinition,
): MigrationDefinition {
  const idMatch = MIGRATION_ID_PATTERN.exec(definition.id);
  if (!idMatch || Number(idMatch[1]) === 0) {
    invalid(`Migration ID must match MIG-0001 or a later four-digit identifier: ${definition.id || "<empty>"}.`);
  }
  if (!definition.description.trim()) {
    invalid(`Migration ${definition.id} must have a description.`);
  }
  if (!Number.isSafeInteger(definition.fromVersion) || definition.fromVersion < 0) {
    invalid(`Migration ${definition.id} has an invalid source version.`);
  }
  if (!Number.isSafeInteger(definition.toVersion) || definition.toVersion <= definition.fromVersion) {
    invalid(`Migration ${definition.id} must advance to a greater safe-integer version.`);
  }
  if (definition.checksumMaterial.length === 0) {
    invalid(`Migration ${definition.id} must declare checksum material.`);
  }
  if (typeof definition.up !== "function") {
    invalid(`Migration ${definition.id} must provide an operation.`);
  }
  if (definition.validate !== undefined && typeof definition.validate !== "function") {
    invalid(`Migration ${definition.id} has an invalid validation hook.`);
  }
  if (
    definition.isStructurallySatisfied !== undefined &&
    typeof definition.isStructurallySatisfied !== "function"
  ) {
    invalid(`Migration ${definition.id} has an invalid structural-satisfaction hook.`);
  }

  return Object.freeze({
    ...definition,
    description: definition.description.trim(),
    checksumMaterial: Object.freeze([...definition.checksumMaterial]),
  });
}
