import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { coreMigrationRegistry } from "./core-migration-registry";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { migrationChecksum } from "./migration-checksum";
import { MigrationRegistry } from "./migration-registry";
import { mcqSessionSpecializationMigration } from "./definitions/mig-0017-mcq-session-specialization";

const executor = (sqlite: DatabaseSync): SqliteExecutor => ({
  all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
  run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
});

describe("MIG-0017 MCQ session specialization", () => {
  it("adds nullable specialization fields without reclassifying historical sessions", () => {
    const sqlite = new DatabaseSync(":memory:");
    const database = executor(sqlite);
    const v16 = new MigrationRegistry(
      coreMigrationRegistry.migrations.filter(migration => migration.id !== "MIG-0017"),
    );
    new FreshDatabaseBootstrap(database, v16).run();
    sqlite.prepare(
      "INSERT INTO mcq_sessions(session_id,mode,status,blueprint_version_id,seed,started_at) VALUES(?,?,?,?,?,?)",
    ).run("legacy-quiz", "QUIZ", "IN_PROGRESS", "bp", "seed", "2026-09-05T12:00:00.000Z");

    expect(new FreshDatabaseBootstrap(database, coreMigrationRegistry).run()).toEqual({
      currentVersion: 17,
      appliedMigrationIds: ["MIG-0017"],
    });
    expect(sqlite.prepare(
      "SELECT session_id,mode,session_kind,duration_seconds FROM mcq_sessions WHERE session_id='legacy-quiz'",
    ).get()).toEqual({
      session_id: "legacy-quiz",
      mode: "QUIZ",
      session_kind: null,
      duration_seconds: null,
    });

    sqlite.prepare(
      "INSERT INTO mcq_sessions(session_id,mode,status,blueprint_version_id,seed,started_at,session_kind,duration_seconds) VALUES(?,?,?,?,?,?,?,?)",
    ).run("standard", "STUDY", "IN_PROGRESS", "bp", "seed", "now", "STANDARD", null);
    sqlite.prepare(
      "INSERT INTO mcq_sessions(session_id,mode,status,blueprint_version_id,seed,started_at,session_kind,duration_seconds) VALUES(?,?,?,?,?,?,?,?)",
    ).run("mock", "QUIZ", "IN_PROGRESS", "bp", "seed", "now", "MOCK_EXAM", 2700);

    expect(sqlite.prepare(
      "SELECT session_kind,duration_seconds FROM mcq_sessions WHERE session_id='mock'",
    ).get()).toEqual({ session_kind: "MOCK_EXAM", duration_seconds: 2700 });
    expect(() => sqlite.prepare(
      "INSERT INTO mcq_sessions(session_id,mode,status,blueprint_version_id,seed,started_at,session_kind) VALUES(?,?,?,?,?,?,?)",
    ).run("invalid-kind", "QUIZ", "IN_PROGRESS", "bp", "seed", "now", "OTHER")).toThrow();
    expect(() => sqlite.prepare(
      "INSERT INTO mcq_sessions(session_id,mode,status,blueprint_version_id,seed,started_at,session_kind,duration_seconds) VALUES(?,?,?,?,?,?,?,?)",
    ).run("invalid-duration", "QUIZ", "IN_PROGRESS", "bp", "seed", "now", "MOCK_EXAM", 0)).toThrow();
    expect(sqlite.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    sqlite.close();
  });

  it("extends the canonical registry contiguously without changing prior migration identities", () => {
    expect(coreMigrationRegistry.currentVersion).toBe(17);
    expect(coreMigrationRegistry.findById("MIG-0017")).toEqual(mcqSessionSpecializationMigration);
    expect(mcqSessionSpecializationMigration).toMatchObject({
      fromVersion: 16,
      toVersion: 17,
    });
    expect(migrationChecksum(mcqSessionSpecializationMigration)).toMatch(/^[a-f0-9]{64}$/);
    expect(coreMigrationRegistry.migrations.map(migration => migration.id)).toEqual(
      Array.from({ length: 17 }, (_, index) => `MIG-${String(index + 1).padStart(4, "0")}`),
    );
  });
});
