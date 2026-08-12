import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SqliteExecutor } from "../sqlite-executor";
import { MigrationError } from "./migration-errors";
import type { AppliedMigration } from "./migration-history-store";
import {
  MIGRATION_HISTORY_TABLE,
  SqliteMigrationHistoryStore,
} from "./sqlite-migration-history-store";

const first: AppliedMigration = {
  migrationId: "MIG-0001",
  fromVersion: 0,
  toVersion: 1,
  description: "Create migration metadata",
  checksum: "a".repeat(64),
  appliedAt: "2026-08-09T12:00:00.000Z",
  durationMs: 12,
  applicationKind: "executed",
  applicationVersion: "1.0.0",
};

describe("SqliteMigrationHistoryStore with isolated SQLite", () => {
  let sqlite: DatabaseSync;
  let executor: SqliteExecutor;
  let store: SqliteMigrationHistoryStore;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    executor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) =>
        sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) =>
        sqlite.prepare(sql).run(...params),
    };
    store = new SqliteMigrationHistoryStore(executor);
  });

  afterEach(() => sqlite.close());

  it("creates only the metadata table and is idempotent", () => {
    store.ensureStorage();
    store.ensureStorage();

    expect(
      sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all(),
    ).toEqual([{ name: MIGRATION_HISTORY_TABLE }]);
    expect(store.list()).toEqual([]);
  });

  it("appends and reads immutable metadata consistently", () => {
    store.ensureStorage();
    store.append(first);

    expect(store.findById(first.migrationId)).toEqual(first);
    expect(store.latest()).toEqual(first);
    expect(Object.isFrozen(store.list())).toBe(true);
    expect(Object.isFrozen(store.list()[0])).toBe(true);
  });

  it("lists history in explicit target-version order", () => {
    store.ensureStorage();
    const second: AppliedMigration = {
      ...first,
      migrationId: "MIG-0002",
      fromVersion: 1,
      toVersion: 2,
      checksum: "b".repeat(64),
      appliedAt: "2026-08-09T12:01:00.000Z",
      durationMs: 4,
      applicationKind: "adopted_existing",
      applicationVersion: null,
    };
    store.append(second);
    store.append(first);

    expect(store.list().map(({ migrationId }) => migrationId)).toEqual([
      "MIG-0001",
      "MIG-0002",
    ]);
  });

  it("rejects duplicate IDs and target versions without rewriting history", () => {
    store.ensureStorage();
    store.append(first);

    expect(() => store.append(first)).toThrow(MigrationError);
    expect(() =>
      store.append({
        ...first,
        migrationId: "MIG-0002",
      }),
    ).toThrow(MigrationError);
    expect(store.list()).toEqual([first]);
  });

  it("uses bound values for metadata and preserves SQL-like text as data", () => {
    const run = vi.fn(executor.run);
    store = new SqliteMigrationHistoryStore({ ...executor, run });
    store.ensureStorage();
    const hostileDescription = "'); DROP TABLE schema_migrations; --";
    store.append({ ...first, description: hostileDescription });

    const insert = run.mock.calls.find(([sql]) => sql.startsWith("INSERT INTO"));
    expect(insert?.[0]).toContain("VALUES (?,?,?,?,?,?,?,?,?)");
    expect(insert).toContain(hostileDescription);
    expect(store.latest()?.description).toBe(hostileDescription);
    expect(
      sqlite.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get(),
    ).toEqual({ count: 1 });
  });

  it("wraps storage failures without exposing database contents", () => {
    const unavailable = new SqliteMigrationHistoryStore({
      all: () => {
        throw new Error("private row content");
      },
      run: () => ({ changes: 0 }),
    });

    expect(() => unavailable.list()).toThrow("Unable to read migration history.");
  });
});
