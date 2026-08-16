import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { BACKUP_DATABASE_FILE } from "../backup/backup-model";
import { SqliteBackupService } from "../backup/sqlite-backup-service";
import {
  CORE_BASELINE_STATEMENTS,
  coreBaselineMigration,
} from "../migrations/definitions/mig-0001-core-baseline";
import {
  IMPORT_JOURNAL_SQL,
  importJournalMigration,
} from "../migrations/definitions/mig-0002-document-import-journal";
import { sourceModelMigration } from "../migrations/definitions/mig-0003-source-model";
import { ragIndexMigration } from "../migrations/definitions/mig-0004-rag-index";
import { clinicalCoachMigration } from "../migrations/definitions/mig-0005-clinical-coach";
import { mcqCoreMigration } from "../migrations/definitions/mig-0006-mcq-core";
import { foundationAcademyCoreMigration } from "../migrations/definitions/mig-0007-foundation-academy-core";
import { canadianPracticeCoreMigration } from "../migrations/definitions/mig-0008-canadian-practice-core";
import { quebecPracticeExtensionMigration } from "../migrations/definitions/mig-0009-quebec-practice-extension";
import { calculationsLabCoreMigration } from "../migrations/definitions/mig-0010-calculations-lab-core";
import { osceTextCoreMigration } from "../migrations/definitions/mig-0011-osce-text-core";
import { FreshDatabaseBootstrap } from "../migrations/fresh-database-bootstrap";
import { MigrationRegistry } from "../migrations/migration-registry";
import {
  ControlledMigrationActivation,
  MIGRATION_APPROVAL_INTENT,
  type MigrationActivationRequest,
  type MigrationAuthorization,
} from "./controlled-migration-activation";

describe("ControlledMigrationActivation", { timeout: 10_000 }, () => {
  let root: string;
  let databasePath: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "mentor-activation-test-"));
    databasePath = path.join(root, "synthetic.sqlite");
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  const dbExecutor = (sqlite: DatabaseSync): SqliteExecutor => ({
    all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
    run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
  });
  const createEmpty = () => { const sqlite = new DatabaseSync(databasePath); sqlite.close(); };
  const createLegacy = (journal = false) => {
    const sqlite = new DatabaseSync(databasePath);
    for (const statement of CORE_BASELINE_STATEMENTS) sqlite.exec(statement);
    sqlite.exec(`
      INSERT INTO subjects(name,color,mastery) VALUES('S','#000',1);
      INSERT INTO documents(name,type,size,subject,status,content) VALUES('D','PDF',1,'S','Ready','x');
      INSERT INTO flashcards(front,back,subject,difficulty) VALUES('F','B','S','Easy');
      INSERT INTO questions(prompt,options,answer,explanation,subject,difficulty,source) VALUES('Q','[]',0,'E','S','Easy','D');
      INSERT INTO attempts(module,subject,score) VALUES('M','S',1);
      INSERT INTO weaknesses(subject,topic,confidence,cause,action) VALUES('S','T','C','C','A');
      INSERT INTO study_tasks(title,subject,task_date,minutes) VALUES('T','S','2026-01-01',5);
      INSERT INTO conversations(role,content) VALUES('user','synthetic');
      INSERT INTO settings(key,value) VALUES('k','v');
    `);
    if (journal) {
      sqlite.exec(IMPORT_JOURNAL_SQL);
      sqlite.prepare("INSERT INTO document_import_journal VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(
        "sid", ".pdf", "D", "application/pdf", 1, "S", "Ready", "x", "ready", 1, 1,
      );
    }
    sqlite.close();
  };
  const createVersion = (version: 1 | 2 | 3 | 4) => {
    const sqlite = new DatabaseSync(databasePath);
    new FreshDatabaseBootstrap(
      dbExecutor(sqlite),
      version === 1
        ? new MigrationRegistry([coreBaselineMigration])
        : version === 2
          ? new MigrationRegistry([coreBaselineMigration, importJournalMigration])
          : version === 3
            ? new MigrationRegistry([coreBaselineMigration, importJournalMigration, sourceModelMigration])
            : undefined,
    ).run();
    sqlite.close();
  };
  const authorization = (
    request: MigrationActivationRequest,
    overrides: Partial<MigrationAuthorization> = {},
  ): MigrationAuthorization => ({
    activationId: request.activationId,
    databaseIdentityHash: request.databaseIdentity.identityHash,
    migrationPlanHash: request.migrationPlanHash,
    backupId: request.backupId,
    approvedAt: request.createdAt,
    approvalIntent: MIGRATION_APPROVAL_INTENT,
    ...overrides,
  });
  const prepare = (service: ControlledMigrationActivation) => service.prepare({
    databasePath,
    backupDestination: path.join(root, "backups"),
    applicationVersion: "test",
  });

  it("dry-runs and activates a fresh synthetic database only with exact authorization", async () => {
    createEmpty();
    const service = new ControlledMigrationActivation();
    const request = await prepare(service);
    expect(request).toMatchObject({
      databaseState: "FRESH",
      currentVersion: 0,
      targetVersion: 11,
      backupId: null,
      requiresExplicitAuthorization: true,
    });
    expect(request.actions.map(({ kind, migrationId }) => [kind, migrationId])).toEqual([
      ["EXECUTE", "MIG-0001"], ["EXECUTE", "MIG-0002"], ["EXECUTE", "MIG-0003"], ["EXECUTE", "MIG-0004"], ["EXECUTE", "MIG-0005"], ["EXECUTE", "MIG-0006"], ["EXECUTE", "MIG-0007"], ["EXECUTE", "MIG-0008"], ["EXECUTE", "MIG-0009"], ["EXECUTE", "MIG-0010"], ["EXECUTE", "MIG-0011"],
    ]);
    expect(await service.execute(databasePath, request, null)).toMatchObject({ status: "BLOCKED", reason: "AUTHORIZATION_MISSING" });
    expect(await service.execute(databasePath, request, authorization(request))).toMatchObject({
      status: "MIGRATION_ACTIVATED", fromVersion: 0, toVersion: 11, verificationStatus: "VERIFIED",
    });
  });

  it.each([false, true])("activates recognized legacy and preserves every synthetic business table (journal=%s)", async (journal) => {
    createLegacy(journal);
    const service = new ControlledMigrationActivation();
    const before = new DatabaseSync(databasePath, { readOnly: true });
    const tables = ["subjects","documents","flashcards","questions","attempts","weaknesses","study_tasks","conversations","settings"];
    const counts = Object.fromEntries(tables.map((table) => [table, before.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()]));
    before.close();
    const request = await prepare(service);
    expect(request.backupId).toMatch(/^BKP-/);
    expect(request.actions[0]).toMatchObject({ kind: "ADOPT_BASELINE", migrationId: "MIG-0001" });
    if (journal) expect(request.actions[1]).toMatchObject({ kind: "ADOPT_EXISTING", migrationId: "MIG-0002" });
    expect(await service.execute(databasePath, request, authorization(request))).toMatchObject({ status: "MIGRATION_ACTIVATED" });
    const after = new DatabaseSync(databasePath, { readOnly: true });
    for (const table of tables) expect(after.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()).toEqual(counts[table]);
    if (journal) expect(after.prepare("SELECT storage_id FROM document_import_journal").get()).toEqual({ storage_id: "sid" });
    after.close();
  });

  it("activates a versioned outdated DB and treats current DB as a verified no-op", async () => {
    createVersion(1);
    const service = new ControlledMigrationActivation();
    const outdated = await prepare(service);
    expect(outdated.actions).toMatchObject([
      { kind: "EXECUTE", migrationId: "MIG-0002" },
      { kind: "EXECUTE", migrationId: "MIG-0003" },
      { kind: "EXECUTE", migrationId: "MIG-0004" },
      { kind: "EXECUTE", migrationId: "MIG-0005" },
      { kind: "EXECUTE", migrationId: "MIG-0006" },
      { kind: "EXECUTE", migrationId: "MIG-0007" },
      { kind: "EXECUTE", migrationId: "MIG-0008" },
      { kind: "EXECUTE", migrationId: "MIG-0009" },
      { kind: "EXECUTE", migrationId: "MIG-0010" },
      { kind: "EXECUTE", migrationId: "MIG-0011" },
    ]);
    expect(await service.execute(databasePath, outdated, authorization(outdated))).toMatchObject({ status: "MIGRATION_ACTIVATED" });
    const current = await prepare(service);
    expect(current.actions).toEqual([]);
    expect(await service.execute(databasePath, current, authorization(current))).toMatchObject({ status: "NO_MIGRATION_REQUIRED" });
  });

  it.each([
    ["unknown", "CREATE TABLE unrelated(id INTEGER)"],
    ["partial", "PARTIAL"],
    ["invalid history", "CREATE TABLE schema_migrations(unrelated TEXT)"],
  ])("blocks preparation for %s", async (_label, fixture) => {
    const sqlite = new DatabaseSync(databasePath);
    if (fixture === "PARTIAL") {
      for (const statement of CORE_BASELINE_STATEMENTS) sqlite.exec(statement);
      sqlite.exec("DROP TABLE weaknesses");
    } else sqlite.exec(fixture);
    sqlite.close();
    await expect(prepare(new ControlledMigrationActivation())).rejects.toThrow(/blocked/);
  });

  it("blocks ahead, checksum mismatch and incompatible current schemas", async () => {
    for (const mode of ["ahead", "checksum", "schema"] as const) {
      const candidate = path.join(root, `${mode}.sqlite`);
      databasePath = candidate;
      createVersion(4);
      const sqlite = new DatabaseSync(candidate);
      if (mode === "ahead") sqlite.prepare("INSERT INTO schema_migrations VALUES(?,?,?,?,?,?,?,?,?)").run("MIG-0012",11,12,"Future","0".repeat(64),"2026-01-01",0,"executed",null);
      if (mode === "checksum") sqlite.prepare("UPDATE schema_migrations SET checksum=? WHERE migration_id='MIG-0001'").run("f".repeat(64));
      if (mode === "schema") sqlite.exec("DROP TABLE document_import_journal; CREATE TABLE document_import_journal(storage_id TEXT PRIMARY KEY)");
      sqlite.close();
      await expect(prepare(new ControlledMigrationActivation())).rejects.toThrow(/blocked/);
    }
  });

  it("rejects wrong, stale and mismatched authorization", async () => {
    createEmpty();
    const service = new ControlledMigrationActivation();
    const request = await prepare(service);
    for (const auth of [
      authorization(request, { activationId: "wrong" }),
      authorization(request, { databaseIdentityHash: "wrong" }),
      authorization(request, { migrationPlanHash: "wrong" }),
      authorization(request, { approvedAt: "2000-01-01T00:00:00.000Z" }),
    ]) expect((await service.execute(databasePath, request, auth)).status).toBe("BLOCKED");
  });

  it("blocks TOCTOU database changes before mutation", async () => {
    createLegacy();
    const service = new ControlledMigrationActivation();
    const request = await prepare(service);
    const sqlite = new DatabaseSync(databasePath);
    sqlite.prepare("UPDATE subjects SET mastery=2").run();
    sqlite.close();
    expect(await service.execute(databasePath, request, authorization(request))).toMatchObject({
      status: "BLOCKED", reason: "DATABASE_CHANGED_SINCE_PREFLIGHT",
    });
    const check = new DatabaseSync(databasePath, { readOnly: true });
    expect(check.prepare("SELECT name FROM sqlite_schema WHERE name='schema_migrations'").get()).toBeUndefined();
    check.close();
  });

  it("allows an unchanged WAL database through prepare and execute", async () => {
    createLegacy();
    const wal = new DatabaseSync(databasePath);
    wal.exec("PRAGMA journal_mode=WAL");
    wal.close();
    const service = new ControlledMigrationActivation();
    const request = await prepare(service);
    expect(await service.execute(databasePath, request, authorization(request))).toMatchObject({
      status: "MIGRATION_ACTIVATED",
      verificationStatus: "VERIFIED",
    });
  });

  it("blocks a committed WAL mutation between prepare and execute", async () => {
    createLegacy();
    const wal = new DatabaseSync(databasePath);
    wal.exec("PRAGMA journal_mode=WAL");
    wal.close();
    const service = new ControlledMigrationActivation();
    const request = await prepare(service);
    const changed = new DatabaseSync(databasePath);
    changed.prepare("UPDATE subjects SET mastery=mastery+1 WHERE name='S'").run();
    changed.close();
    expect(await service.execute(databasePath, request, authorization(request))).toMatchObject({
      status: "BLOCKED",
      reason: "DATABASE_CHANGED_SINCE_PREFLIGHT",
    });
  });

  it("invalidates authorization when the registry plan changes", async () => {
    createLegacy();
    const original = new ControlledMigrationActivation();
    const request = await prepare(original);
    const extra = { id: "MIG-0012", fromVersion: 11, toVersion: 12, description: "Synthetic", checksumMaterial: ["v1"], up: () => undefined };
    const changed = new ControlledMigrationActivation(new MigrationRegistry([coreBaselineMigration, importJournalMigration, sourceModelMigration, ragIndexMigration, clinicalCoachMigration, mcqCoreMigration, foundationAcademyCoreMigration, canadianPracticeCoreMigration, quebecPracticeExtensionMigration, calculationsLabCoreMigration, osceTextCoreMigration, extra]));
    expect(await changed.execute(databasePath, request, authorization(request))).toMatchObject({ status: "BLOCKED", reason: "MIGRATION_PLAN_CHANGED" });
  });

  it("blocks a corrupted bound backup", async () => {
    createLegacy();
    const service = new ControlledMigrationActivation();
    const request = await prepare(service);
    await writeFile(path.join(request.backup!.packageDirectory, BACKUP_DATABASE_FILE), "corrupt");
    expect(await service.execute(databasePath, request, authorization(request))).toMatchObject({ status: "BLOCKED", reason: "BACKUP_INVALID" });
  });

  it("reports migration failure with staged recovery available and never auto-restores", async () => {
    createVersion(2);
    const failing = {
      id: "MIG-0003", fromVersion: 2, toVersion: 3, description: "Failing", checksumMaterial: ["fail-v1"],
      up: (database: SqliteExecutor) => { database.run("CREATE TABLE rollback_me(id INTEGER)"); throw new Error("synthetic"); },
    };
    const service = new ControlledMigrationActivation(new MigrationRegistry([coreBaselineMigration, importJournalMigration, failing]));
    const request = await prepare(service);
    const result = await service.execute(databasePath, request, authorization(request));
    expect(result).toMatchObject({ status: "MIGRATION_FAILED_RECOVERY_AVAILABLE", recovery: "RESTORE_TO_STAGING_AVAILABLE" });
    const active = new DatabaseSync(databasePath, { readOnly: true });
    expect(active.prepare("SELECT name FROM sqlite_schema WHERE name='rollback_me'").get()).toBeUndefined();
    active.close();
    const staging = path.join(root, "recovery", "staged.sqlite");
    await new SqliteBackupService().restoreToStaging(request.backup!, staging, databasePath);
    expect(await readFile(staging)).toEqual(await readFile(path.join(request.backup!.packageDirectory, BACKUP_DATABASE_FILE)));
  });

  it("never reports success when post-validation fails", async () => {
    createVersion(1);
    const service = new ControlledMigrationActivation(undefined, undefined, undefined, () => false);
    const request = await prepare(service);
    expect(await service.execute(databasePath, request, authorization(request))).toMatchObject({
      status: "MIGRATION_FAILED_RECOVERY_AVAILABLE", reason: "POST_VALIDATION_FAILED",
    });
  });
});
