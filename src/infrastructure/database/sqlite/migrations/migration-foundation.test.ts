import { describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { migrationChecksum } from "./migration-checksum";
import {
  defineMigration,
  type MigrationDefinition,
} from "./migration-definition";
import { MigrationError } from "./migration-errors";
import { MigrationRegistry } from "./migration-registry";

const noOperation: (database: SqliteExecutor) => void = () => undefined;

function migration(
  overrides: Partial<MigrationDefinition> = {},
): MigrationDefinition {
  return {
    id: "MIG-0001",
    fromVersion: 0,
    toVersion: 1,
    description: "Create infrastructure metadata",
    checksumMaterial: ["schema-migrations:v1"],
    up: noOperation,
    ...overrides,
  };
}

function expectCode(operation: () => unknown, code: MigrationError["code"]): void {
  try {
    operation();
    throw new Error("Expected a MigrationError.");
  } catch (error) {
    expect(error).toBeInstanceOf(MigrationError);
    expect((error as MigrationError).code).toBe(code);
  }
}

describe("migration definitions", () => {
  it("creates an immutable valid definition", () => {
    const definition = defineMigration(migration());

    expect(definition.id).toBe("MIG-0001");
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.checksumMaterial)).toBe(true);
  });

  it.each([
    ["empty ID", { id: "" }],
    ["malformed ID", { id: "migration-1" }],
    ["zero ID", { id: "MIG-0000" }],
    ["empty description", { description: "  " }],
    ["negative source", { fromVersion: -1 }],
    ["same versions", { fromVersion: 1, toVersion: 1 }],
    ["backwards transition", { fromVersion: 2, toVersion: 1 }],
    ["non-integer target", { toVersion: 1.5 }],
    ["empty checksum material", { checksumMaterial: [] }],
  ])("rejects %s", (_label, overrides) => {
    expectCode(
      () => defineMigration(migration(overrides as Partial<MigrationDefinition>)),
      "INVALID_MIGRATION_DEFINITION",
    );
  });
});

describe("migration checksums", () => {
  it("produces deterministic SHA-256 output", () => {
    const definition = defineMigration(migration());
    const first = migrationChecksum(definition);

    expect(migrationChecksum(definition)).toBe(first);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    ["identity", { id: "MIG-0002" }],
    ["source version", { fromVersion: 1, toVersion: 2 }],
    ["target version", { toVersion: 2 }],
    ["description", { description: "Changed description" }],
    ["semantic material", { checksumMaterial: ["schema-migrations:v2"] }],
  ])("changes when %s changes", (_label, overrides) => {
    expect(migrationChecksum(migration(overrides as Partial<MigrationDefinition>))).not.toBe(
      migrationChecksum(migration()),
    );
  });

  it("normalizes platform line endings and excludes unrelated runtime metadata", () => {
    const withRuntimeMetadata = {
      ...migration({ checksumMaterial: ["first\r\nsecond  "] }),
      runtimeTimestamp: "2099-01-01T00:00:00.000Z",
      localPath: "C:\\private\\mentor.db",
    };
    const canonical = migration({ checksumMaterial: ["first\nsecond"] });

    expect(migrationChecksum(withRuntimeMetadata)).toBe(migrationChecksum(canonical));
  });
});

describe("MigrationRegistry", () => {
  it("defines explicit empty-registry behavior", () => {
    const registry = new MigrationRegistry([]);

    expect(registry.migrations).toEqual([]);
    expect(registry.currentVersion).toBe(0);
  });

  it("orders a valid chain by version independently of input order", () => {
    const second = migration({
      id: "MIG-0002",
      fromVersion: 1,
      toVersion: 2,
      checksumMaterial: ["second"],
    });
    const first = migration();
    const registry = new MigrationRegistry([second, first]);

    expect(registry.migrations.map(({ id }) => id)).toEqual(["MIG-0001", "MIG-0002"]);
    expect(registry.findById("MIG-0002")).toMatchObject({ toVersion: 2 });
    expect(registry.findByVersion(1)).toMatchObject({ id: "MIG-0001" });
    expect(registry.currentVersion).toBe(2);
    expect(new MigrationRegistry([second, first]).migrations).toEqual(registry.migrations);
  });

  it("rejects duplicate identities", () => {
    expectCode(
      () =>
        new MigrationRegistry([
          migration(),
          migration({ fromVersion: 1, toVersion: 2, checksumMaterial: ["second"] }),
        ]),
      "DUPLICATE_MIGRATION_ID",
    );
  });

  it("rejects duplicate target versions", () => {
    expectCode(
      () =>
        new MigrationRegistry([
          migration(),
          migration({ id: "MIG-0002", checksumMaterial: ["second"] }),
        ]),
      "DUPLICATE_MIGRATION_VERSION",
    );
  });

  it.each([
    ["gap", migration({ id: "MIG-0002", fromVersion: 1, toVersion: 2 })],
    ["jump", migration({ fromVersion: 0, toVersion: 2 })],
    ["branch", migration({ id: "MIG-0002", fromVersion: 0, toVersion: 2 })],
  ])("rejects an invalid %s chain", (_label, definition) => {
    expectCode(() => new MigrationRegistry([definition]), "INVALID_MIGRATION_CHAIN");
  });

  it("does not expose a mutable migration collection", () => {
    const registry = new MigrationRegistry([migration()]);

    expect(() =>
      (registry.migrations as MigrationDefinition[]).push(
        migration({ id: "MIG-0002", fromVersion: 1, toVersion: 2 }),
      ),
    ).toThrow();
    expect(registry.migrations).toHaveLength(1);
  });
});
