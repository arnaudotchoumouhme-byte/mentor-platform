import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import type { VerifiedBackup } from "../backup/backup-model";
import {
  CORE_BASELINE_STATEMENTS,
  coreBaselineMigration,
} from "../migrations/definitions/mig-0001-core-baseline";
import { IMPORT_JOURNAL_SQL } from "../migrations/definitions/mig-0002-document-import-journal";
import { FreshDatabaseBootstrap } from "../migrations/fresh-database-bootstrap";
import { MigrationRegistry } from "../migrations/migration-registry";
import {
  DatabaseMigrationPreflight,
  inspectDatabaseFileReadOnly,
} from "./database-migration-preflight";

const verifiedBackup = {
  status: "VERIFIED",
  packageDirectory: "synthetic",
  manifest: {
    backupId: "BKP-SYNTHETIC",
    createdAt: "2026-01-01T00:00:00.000Z",
    applicationVersion: null,
    schemaVersion: 1,
    backupFormatVersion: 1,
    databaseFile: "mentor.sqlite",
    databaseChecksum: "0".repeat(64),
    sourceDatabaseIdentity: { kind: "SQLITE_FILE", fileName: "synthetic.sqlite" },
    sourceDatabaseFingerprint: "1".repeat(64),
    status: "COMPLETE",
  },
} as const satisfies VerifiedBackup;

describe("DatabaseMigrationPreflight", () => {
  let sqlite: DatabaseSync;
  let database: SqliteExecutor;
  let root: string;
  let databasePath: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "mentor-preflight-test-"));
    databasePath = path.join(root, "synthetic.sqlite");
    sqlite = new DatabaseSync(databasePath);
    database = {
      all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
    };
  });
  afterEach(async () => {
    sqlite.close();
    await rm(root, { recursive: true, force: true });
  });

  const fileFingerprint = () => {
    const hash = createHash("sha256");
    for (const candidate of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
      if (existsSync(candidate)) hash.update(readFileSync(candidate));
    }
    return hash.digest("hex");
  };

  const preflight = (backup: VerifiedBackup | null | "UNVERIFIED" = null) => {
    const before = fileFingerprint();
    const result = new DatabaseMigrationPreflight(database).inspect(backup);
    expect(fileFingerprint()).toEqual(before);
    return result;
  };
  const legacy = () => { for (const statement of CORE_BASELINE_STATEMENTS) sqlite.exec(statement); };

  it("dry-runs fresh migration without creating metadata", () => {
    expect(preflight()).toMatchObject({
      status: "REQUIRES_EXPLICIT_AUTHORIZATION",
      schemaState: "FRESH",
      pendingMigrations: ["MIG-0001", "MIG-0002", "MIG-0003", "MIG-0004", "MIG-0005", "MIG-0006", "MIG-0007"],
      backupRequirement: "BACKUP_NOT_REQUIRED",
      migrationAllowed: false,
    });
  });

  it("requires a verified backup and explicit authorization for legacy core", () => {
    legacy();
    expect(preflight()).toMatchObject({ status: "BLOCKED", schemaState: "LEGACY_RECOGNIZED", backupRequirement: "BACKUP_REQUIRED_MISSING" });
    expect(preflight("UNVERIFIED")).toMatchObject({ status: "BLOCKED", backupRequirement: "BACKUP_REQUIRED_UNVERIFIED" });
    expect(preflight(verifiedBackup)).toMatchObject({
      status: "REQUIRES_EXPLICIT_AUTHORIZATION",
      backupRequirement: "BACKUP_VERIFIED",
      migrationAllowed: false,
      explicitConfirmationRequired: true,
    });
  });

  it("recognizes legacy with journal without modifying journal data", () => {
    legacy();
    sqlite.exec(IMPORT_JOURNAL_SQL);
    sqlite.prepare("INSERT INTO document_import_journal VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(
      "id", ".pdf", "Synthetic", "application/pdf", 1, "Test", "Ready", "x", "ready", 1, null,
    );
    expect(preflight(verifiedBackup)).toMatchObject({ schemaState: "LEGACY_RECOGNIZED", status: "REQUIRES_EXPLICIT_AUTHORIZATION" });
  });

  it("classifies versioned outdated and current databases", () => {
    new FreshDatabaseBootstrap(database, new MigrationRegistry([coreBaselineMigration])).run();
    expect(preflight()).toMatchObject({ schemaState: "VERSIONED_OUTDATED", backupRequirement: "BACKUP_REQUIRED_MISSING" });
    new FreshDatabaseBootstrap(database).run();
    expect(preflight()).toMatchObject({ status: "NO_MIGRATION", schemaState: "VERSIONED_CURRENT", riskLevel: "MR0" });
  });

  it.each([
    ["unknown", "CREATE TABLE unrelated(id INTEGER)", "LEGACY_UNKNOWN"],
    ["partial", "PARTIAL", "LEGACY_PARTIAL"],
  ])("blocks %s legacy without mutation", (_label, fixture, state) => {
    if (fixture === "PARTIAL") { legacy(); sqlite.exec("DROP TABLE weaknesses"); }
    else sqlite.exec(fixture);
    expect(preflight()).toMatchObject({ status: "BLOCKED", schemaState: state });
  });

  it("blocks malformed history and checksum mismatch without repair", () => {
    sqlite.exec("CREATE TABLE schema_migrations(unrelated TEXT)");
    expect(preflight()).toMatchObject({ status: "BLOCKED", schemaState: "INVALID_HISTORY" });
    sqlite.close();
    databasePath = path.join(root, "checksum.sqlite");
    sqlite = new DatabaseSync(databasePath);
    database = {
      all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
    };
    new FreshDatabaseBootstrap(database).run();
    sqlite.prepare("UPDATE schema_migrations SET checksum=? WHERE migration_id='MIG-0001'").run("f".repeat(64));
    expect(preflight()).toMatchObject({ status: "BLOCKED", schemaState: "CHECKSUM_MISMATCH" });
  });

  it("blocks a database ahead and an incompatible current schema", () => {
    new FreshDatabaseBootstrap(database).run();
    sqlite.prepare("INSERT INTO schema_migrations VALUES(?,?,?,?,?,?,?,?,?)").run(
      "MIG-0008", 7, 8, "Future", "0".repeat(64), "2026-01-01T00:00:00.000Z", 0, "executed", null,
    );
    expect(preflight()).toMatchObject({ status: "BLOCKED", schemaState: "VERSIONED_AHEAD" });
  });

  it("blocks an incompatible journal recorded as current", () => {
    new FreshDatabaseBootstrap(database).run();
    sqlite.exec("DROP TABLE document_import_journal; CREATE TABLE document_import_journal(storage_id TEXT PRIMARY KEY)");
    expect(preflight()).toMatchObject({ status: "BLOCKED", schemaState: "SCHEMA_INCOMPATIBLE" });
  });

  it("blocks corrupt database input", () => {
    const corruptExecutor: SqliteExecutor = {
      all: () => { throw new Error("synthetic corrupt database"); },
      run: () => { throw new Error("must not write"); },
    };
    expect(new DatabaseMigrationPreflight(corruptExecutor).inspect()).toMatchObject({
      status: "BLOCKED",
      schemaState: "PREFLIGHT_BLOCKED",
      blockers: ["REAL_DB_PREFLIGHT_BLOCKED"],
    });
  });

  it("opens a supplied database strictly read-only and blocks corrupt files", async () => {
    const before = fileFingerprint();
    expect(inspectDatabaseFileReadOnly(databasePath)).toMatchObject({ schemaState: "FRESH" });
    expect(fileFingerprint()).toBe(before);
    const corruptPath = path.join(root, "corrupt.sqlite");
    await writeFile(corruptPath, "not-a-sqlite-database");
    expect(inspectDatabaseFileReadOnly(corruptPath)).toMatchObject({
      status: "BLOCKED",
      schemaState: "CORRUPT_DATABASE",
    });
    expect(readFileSync(corruptPath, "utf8")).toBe("not-a-sqlite-database");
  });

  it("reports an obvious busy database without attempting a write", () => {
    const busyExecutor: SqliteExecutor = {
      all: () => { throw new Error("database is locked"); },
      run: () => { throw new Error("must not write"); },
    };
    expect(new DatabaseMigrationPreflight(busyExecutor).inspect()).toMatchObject({
      status: "BLOCKED",
      schemaState: "DATABASE_BUSY",
      blockers: ["DATABASE_BUSY"],
    });
  });
});
