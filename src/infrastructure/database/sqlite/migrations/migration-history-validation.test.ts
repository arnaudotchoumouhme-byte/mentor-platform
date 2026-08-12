import { describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { migrationChecksum } from "./migration-checksum";
import type { MigrationDefinition } from "./migration-definition";
import { MigrationError } from "./migration-errors";
import { validateMigrationHistory } from "./migration-history-validation";
import type { AppliedMigration } from "./migration-history-store";
import { MigrationRegistry } from "./migration-registry";

const noOperation: (database: SqliteExecutor) => void = () => undefined;

const first: MigrationDefinition = {
  id: "MIG-0001",
  fromVersion: 0,
  toVersion: 1,
  description: "First",
  checksumMaterial: ["first:v1"],
  up: noOperation,
};
const second: MigrationDefinition = {
  id: "MIG-0002",
  fromVersion: 1,
  toVersion: 2,
  description: "Second",
  checksumMaterial: ["second:v1"],
  up: noOperation,
};
const registry = new MigrationRegistry([first, second]);

function applied(
  definition: MigrationDefinition,
  overrides: Partial<AppliedMigration> = {},
): AppliedMigration {
  return {
    migrationId: definition.id,
    fromVersion: definition.fromVersion,
    toVersion: definition.toVersion,
    description: definition.description,
    checksum: migrationChecksum(definition),
    appliedAt: "2026-08-09T12:00:00.000Z",
    durationMs: 1,
    applicationKind: "executed",
    applicationVersion: null,
    ...overrides,
  };
}

function expectCode(history: readonly AppliedMigration[], code: MigrationError["code"]): void {
  try {
    validateMigrationHistory(history, registry);
    throw new Error("Expected a MigrationError.");
  } catch (error) {
    expect(error).toBeInstanceOf(MigrationError);
    expect((error as MigrationError).code).toBe(code);
  }
}

describe("migration history integrity validation", () => {
  it("accepts empty and complete contiguous history", () => {
    expect(() => validateMigrationHistory([], registry)).not.toThrow();
    expect(() =>
      validateMigrationHistory([applied(first), applied(second)], registry),
    ).not.toThrow();
  });

  it("fails closed for an unknown applied migration", () => {
    expectCode(
      [applied(first, { migrationId: "MIG-0099" })],
      "UNKNOWN_APPLIED_MIGRATION",
    );
  });

  it("fails closed for checksum drift", () => {
    expectCode(
      [applied(first, { checksum: "f".repeat(64) })],
      "MIGRATION_CHECKSUM_MISMATCH",
    );
  });

  it("rejects altered stored metadata", () => {
    expectCode(
      [applied(first, { description: "Altered" })],
      "INVALID_MIGRATION_HISTORY",
    );
  });

  it("detects history ahead of the registry", () => {
    expectCode(
      [applied(first), applied(second, { toVersion: 3 })],
      "MIGRATION_HISTORY_AHEAD",
    );
  });

  it.each([
    ["duplicate ID", [applied(first), applied(first)]],
    ["duplicate version", [applied(first), applied(second, { toVersion: 1 })]],
    ["gap", [applied(second)]],
    ["contradictory transition", [applied(first, { fromVersion: 1 })]],
  ])("rejects %s", (_label, history) => {
    expectCode(history, "INVALID_MIGRATION_HISTORY");
  });
});
