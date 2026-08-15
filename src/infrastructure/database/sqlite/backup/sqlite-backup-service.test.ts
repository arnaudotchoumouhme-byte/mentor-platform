import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { FreshDatabaseBootstrap } from "../migrations/fresh-database-bootstrap";
import { DatabaseReadinessOrchestrator } from "../migrations/database-readiness-orchestrator";
import { CORE_BASELINE_STATEMENTS } from "../migrations/definitions/mig-0001-core-baseline";
import { DatabaseMigrationPreflight } from "../preflight/database-migration-preflight";
import {
  BACKUP_DATABASE_FILE,
  BACKUP_MANIFEST_FILE,
  BackupError,
} from "./backup-model";
import {
  SqliteBackupService,
  sqliteFileStateFingerprint,
} from "./sqlite-backup-service";

describe("SqliteBackupService", () => {
  let root: string;
  let sourcePath: string;
  let source: DatabaseSync;
  const service = new SqliteBackupService();

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "mentor-backup-test-"));
    sourcePath = path.join(root, "source.sqlite");
    source = new DatabaseSync(sourcePath);
    source.exec("CREATE TABLE synthetic(id INTEGER PRIMARY KEY,value TEXT); INSERT INTO synthetic VALUES(1,'preserved')");
  });

  afterEach(async () => {
    try { source.close(); } catch { /* already closed by the test */ }
    await rm(root, { recursive: true, force: true });
  });

  const create = () => service.create({
    sourceDatabase: source,
    sourcePath,
    destinationDirectory: path.join(root, "backups"),
    schemaVersion: 0,
    applicationVersion: "test",
    now: new Date("2026-01-01T00:00:00.000Z"),
  });

  const sourceFingerprint = () => {
    const hash = createHash("sha256");
    for (const candidate of [sourcePath, `${sourcePath}-wal`, `${sourcePath}-shm`]) {
      if (existsSync(candidate)) hash.update(readFileSync(candidate));
    }
    return hash.digest("hex");
  };

  it("creates and verifies a complete self-describing package without changing the source", async () => {
    const before = sourceFingerprint();
    const verified = await create();
    expect(verified.status).toBe("VERIFIED");
    expect(verified.manifest).toMatchObject({
      backupFormatVersion: 1,
      schemaVersion: 0,
      databaseFile: BACKUP_DATABASE_FILE,
      status: "COMPLETE",
      sourceDatabaseIdentity: { fileName: "source.sqlite" },
    });
    expect(verified.manifest.databaseChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(await readFile(path.join(verified.packageDirectory, BACKUP_MANIFEST_FILE), "utf8"))).toEqual(verified.manifest);
    expect(sourceFingerprint()).toEqual(before);
  });

  it("creates collision-resistant identities for repeated backups", async () => {
    const first = await create();
    const second = await create();
    expect(second.manifest.backupId).not.toBe(first.manifest.backupId);
    expect(second.packageDirectory).not.toBe(first.packageDirectory);
  });

  it("preserves committed WAL content through the native SQLite backup API", async () => {
    source.exec("PRAGMA journal_mode=WAL; INSERT INTO synthetic VALUES(2,'in-wal')");
    const verified = await create();
    const copy = new DatabaseSync(path.join(verified.packageDirectory, BACKUP_DATABASE_FILE), { readOnly: true });
    expect(copy.prepare("SELECT * FROM synthetic ORDER BY id").all()).toEqual([
      { id: 1, value: "preserved" },
      { id: 2, value: "in-wal" },
    ]);
    copy.close();
  });

  it("keeps the logical fingerprint stable across read-only WAL activity", async () => {
    source.exec("PRAGMA journal_mode=WAL");
    const before = await sqliteFileStateFingerprint(sourcePath);
    const reader = new DatabaseSync(sourcePath, { readOnly: true });
    reader.exec("PRAGMA query_only=ON");
    reader.prepare("PRAGMA integrity_check").all();
    reader.close();
    expect(await sqliteFileStateFingerprint(sourcePath)).toBe(before);
  });

  it("detects committed WAL changes and remains stable after checkpoint", async () => {
    source.exec("PRAGMA journal_mode=WAL");
    const before = await sqliteFileStateFingerprint(sourcePath);
    source.prepare("INSERT INTO synthetic VALUES(2,'committed-in-wal')").run();
    const inWal = await sqliteFileStateFingerprint(sourcePath);
    expect(inWal).not.toBe(before);
    source.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    expect(await sqliteFileStateFingerprint(sourcePath)).toBe(inWal);
  });

  it("rejects missing, unsupported and corrupted packages", async () => {
    await expect(service.verify(path.join(root, "missing"))).rejects.toBeInstanceOf(BackupError);
    const unsupported = await create();
    const manifestPath = path.join(unsupported.packageDirectory, BACKUP_MANIFEST_FILE);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    await writeFile(manifestPath, JSON.stringify({ ...manifest, backupFormatVersion: 99 }));
    await expect(service.verify(unsupported.packageDirectory)).rejects.toMatchObject({ code: "BACKUP_MANIFEST_INVALID" });

    const corrupted = await create();
    await writeFile(path.join(corrupted.packageDirectory, BACKUP_DATABASE_FILE), "corrupt");
    await expect(service.verify(corrupted.packageDirectory)).rejects.toMatchObject({ code: "BACKUP_CHECKSUM_MISMATCH" });
  });

  it("restores only to a new staging path and verifies restored readiness", async () => {
    source.exec("DROP TABLE synthetic");
    const executor: SqliteExecutor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) => source.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) => source.prepare(sql).run(...params),
    };
    new FreshDatabaseBootstrap(executor).run();
    source.prepare("INSERT INTO subjects(name,color,mastery) VALUES(?,?,?)").run("Synthetic", "#000", 9);
    const verified = await service.create({
      sourceDatabase: source,
      sourcePath,
      destinationDirectory: path.join(root, "backups"),
      schemaVersion: 8,
    });
    const stagingPath = path.join(root, "restore", "staged.sqlite");
    const restored = await service.restoreToStaging(verified, stagingPath, sourcePath);
    const staging = new DatabaseSync(restored.databasePath);
    const stagingExecutor: SqliteExecutor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) => staging.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) => staging.prepare(sql).run(...params),
    };
    expect(new DatabaseReadinessOrchestrator(stagingExecutor).ensureReady()).toMatchObject({
      status: "READY",
      initialState: "VERSIONED_CURRENT",
    });
    expect(staging.prepare("SELECT name,mastery FROM subjects WHERE name='Synthetic'").get()).toEqual({ name: "Synthetic", mastery: 9 });
    staging.close();
  });

  it("never overwrites an active or existing database", async () => {
    const verified = await create();
    const activeBefore = sourceFingerprint();
    await expect(service.restoreToStaging(verified, sourcePath, sourcePath)).rejects.toMatchObject({ code: "RESTORE_FAILED" });
    const occupied = path.join(root, "occupied.sqlite");
    await writeFile(occupied, "keep");
    await expect(service.restoreToStaging(verified, occupied)).rejects.toMatchObject({ code: "RESTORE_FAILED" });
    expect(await readFile(occupied, "utf8")).toBe("keep");
    expect(sourceFingerprint()).toEqual(activeBefore);
  });

  it("supports recovery into staging while preserving the intentionally changed active test DB", async () => {
    const verified = await create();
    source.prepare("UPDATE synthetic SET value='changed-active' WHERE id=1").run();
    const restored = await service.restoreToStaging(verified, path.join(root, "recovery", "staged.sqlite"), sourcePath);
    const staged = new DatabaseSync(restored.databasePath, { readOnly: true });
    expect(staged.prepare("SELECT value FROM synthetic WHERE id=1").get()).toEqual({ value: "preserved" });
    expect(source.prepare("SELECT value FROM synthetic WHERE id=1").get()).toEqual({ value: "changed-active" });
    staged.close();
  });

  it("satisfies preflight backup policy but still requires explicit authorization", async () => {
    source.exec("DROP TABLE synthetic");
    for (const statement of CORE_BASELINE_STATEMENTS) source.exec(statement);
    const executor: SqliteExecutor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) => source.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) => source.prepare(sql).run(...params),
    };
    expect(new DatabaseMigrationPreflight(executor).inspect()).toMatchObject({
      status: "BLOCKED",
      backupRequirement: "BACKUP_REQUIRED_MISSING",
    });
    const verified = await service.create({
      sourceDatabase: source,
      sourcePath,
      destinationDirectory: path.join(root, "policy-backups"),
      schemaVersion: 0,
    });
    expect(new DatabaseMigrationPreflight(executor).inspect(verified)).toMatchObject({
      status: "REQUIRES_EXPLICIT_AUTHORIZATION",
      backupRequirement: "BACKUP_VERIFIED",
      migrationAllowed: false,
      blockers: ["MIGRATION_EXPLICIT_AUTHORIZATION_REQUIRED"],
    });
  });
});
