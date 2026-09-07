import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { BACKUP_DATABASE_FILE } from "../backup/backup-model";
import { coreMigrationRegistry } from "../migrations/core-migration-registry";
import { FreshDatabaseBootstrap } from "../migrations/fresh-database-bootstrap";
import { MigrationRegistry } from "../migrations/migration-registry";
import {
  ControlledMigrationActivation,
  MIGRATION_APPROVAL_INTENT,
  type MigrationActivationRequest,
} from "./controlled-migration-activation";
import { BACKUP_APPROVAL_INTENT, runMigrationOperator } from "./migration-operator-cli";

describe("migration operator CLI", { timeout: 30_000 }, () => {
  let root: string;
  let databasePath: string;
  let requestPath: string;
  let authorizationPath: string;
  let backupsPath: string;
  let output: string[];
  let errors: string[];

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "mentor-migration-operator-"));
    databasePath = path.join(root, "synthetic.sqlite");
    requestPath = path.join(root, "request.json");
    authorizationPath = path.join(root, "authorization.json");
    backupsPath = path.join(root, "backups");
    output = [];
    errors = [];
    const sqlite = new DatabaseSync(databasePath);
    const database: SqliteExecutor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
    };
    const v16 = new MigrationRegistry(coreMigrationRegistry.migrations.filter(migration => migration.id !== "MIG-0017"));
    new FreshDatabaseBootstrap(database, v16).run();
    sqlite.close();
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  const io = () => ({ log: (value: string) => output.push(value), error: (value: string) => errors.push(value) });
  const environment: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  const prepareArgs = (targetRequest = requestPath, extra: readonly string[] = []) => [
    "prepare",
    `--database=${databasePath}`,
    `--backup-destination=${backupsPath}`,
    `--request-output=${targetRequest}`,
    "--application-version=synthetic-test",
    ...extra,
  ];
  const authorization = (request: MigrationActivationRequest, overrides: Readonly<Record<string, unknown>> = {}) => ({
    activationId: request.activationId,
    databaseIdentityHash: request.databaseIdentity.identityHash,
    migrationPlanHash: request.migrationPlanHash,
    backupId: request.backupId,
    approvedAt: request.createdAt,
    approvalIntent: MIGRATION_APPROVAL_INTENT,
    ...overrides,
  });
  const schemaVersion = (target = databasePath) => {
    const sqlite = new DatabaseSync(target, { readOnly: true });
    try { return (sqlite.prepare("SELECT MAX(to_version) AS version FROM schema_migrations").get() as { version: number }).version; }
    finally { sqlite.close(); }
  };
  const applyArgs = (targetDatabase = databasePath, targetRequest = requestPath, targetAuthorization = authorizationPath) => [
    "apply", `--database=${targetDatabase}`, `--request=${targetRequest}`, `--authorization=${targetAuthorization}`,
  ];

  it("requires explicit backup intent and exact authorization before applying v16 to v17", async () => {
    expect(await runMigrationOperator(prepareArgs(), environment, io())).toBe(2);
    expect(errors.join("\n")).toContain("MIGRATION_OPERATOR_BACKUP_AUTHORIZATION_REQUIRED");
    expect(schemaVersion()).toBe(16);

    expect(await runMigrationOperator(prepareArgs(requestPath, [`--backup-intent=${BACKUP_APPROVAL_INTENT}`]), environment, io())).toBe(0);
    const request = JSON.parse(await readFile(requestPath, "utf8")) as MigrationActivationRequest;
    expect(request).toMatchObject({ currentVersion: 16, targetVersion: 17, pendingMigrationIds: ["MIG-0017"], backup: { status: "VERIFIED" } });
    expect(await runMigrationOperator(applyArgs(databasePath, requestPath, path.join(root, "missing-authorization.json")), environment, io())).toBe(2);
    expect(schemaVersion()).toBe(16);

    await writeFile(authorizationPath, JSON.stringify(authorization(request)));
    expect(await runMigrationOperator(applyArgs(), environment, io())).toBe(0);
    expect(schemaVersion()).toBe(17);
    const sqlite = new DatabaseSync(databasePath, { readOnly: true });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE migration_id='MIG-0017'").get()).toEqual({ count: 1 });
    sqlite.close();

    const retryRequestPath = path.join(root, "retry-request.json");
    const retryAuthorizationPath = path.join(root, "retry-authorization.json");
    expect(await runMigrationOperator(prepareArgs(retryRequestPath), environment, io())).toBe(0);
    const retry = JSON.parse(await readFile(retryRequestPath, "utf8")) as MigrationActivationRequest;
    expect(retry.pendingMigrationIds).toEqual([]);
    await writeFile(retryAuthorizationPath, JSON.stringify(authorization(retry)));
    expect(await runMigrationOperator(applyArgs(databasePath, retryRequestPath, retryAuthorizationPath), environment, io())).toBe(0);
    expect(output.at(-1)).toContain("NO_MIGRATION_REQUIRED");
  });

  it("blocks wrong plan authorization and a request bound to a different database", async () => {
    expect(await runMigrationOperator(prepareArgs(requestPath, [`--backup-intent=${BACKUP_APPROVAL_INTENT}`]), environment, io())).toBe(0);
    const request = JSON.parse(await readFile(requestPath, "utf8")) as MigrationActivationRequest;
    await writeFile(authorizationPath, JSON.stringify(authorization(request, { migrationPlanHash: "wrong" })));
    expect(await runMigrationOperator(applyArgs(), environment, io())).toBe(3);
    expect(output.at(-1)).toContain("AUTHORIZATION_INVALID");

    const otherPath = path.join(root, "other.sqlite");
    await copyFile(databasePath, otherPath);
    await writeFile(authorizationPath, JSON.stringify(authorization(request)));
    expect(await runMigrationOperator(applyArgs(otherPath), environment, io())).toBe(3);
    expect(output.at(-1)).toContain("DATABASE_IDENTITY_MISMATCH");
    expect(schemaVersion()).toBe(16);
  });

  it("blocks a corrupted backup bound to the prepared activation", async () => {
    expect(await runMigrationOperator(prepareArgs(requestPath, [`--backup-intent=${BACKUP_APPROVAL_INTENT}`]), environment, io())).toBe(0);
    const request = JSON.parse(await readFile(requestPath, "utf8")) as MigrationActivationRequest;
    await writeFile(authorizationPath, JSON.stringify(authorization(request)));
    await writeFile(path.join(request.backup!.packageDirectory, BACKUP_DATABASE_FILE), "corrupt");
    expect(await runMigrationOperator(applyArgs(), environment, io())).toBe(3);
    expect(output.at(-1)).toContain("BACKUP_INVALID");
    expect(schemaVersion()).toBe(16);
  });

  it("fails closed before inspection when production targets a database outside persistent data", async () => {
    let inspected = false;
    let persistentStorageValidated = false;
    const productionEnvironment: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      RENDER: "true",
      MENTOR_PERSISTENT_MOUNT_PATH: path.join(root, "persistent"),
      MENTOR_DATA_DIRECTORY: path.join(root, "persistent", "data"),
    };

    expect(await runMigrationOperator(
      prepareArgs(requestPath, [`--backup-intent=${BACKUP_APPROVAL_INTENT}`]),
      productionEnvironment,
      io(),
      {
        activation: new ControlledMigrationActivation(),
        inspect: () => { inspected = true; throw new Error("must not inspect"); },
        validatePersistentStorage: () => { persistentStorageValidated = true; },
      },
    )).toBe(2);
    expect(errors.at(-1)).toContain("MIGRATION_OPERATOR_DATABASE_TARGET_MISMATCH");
    expect(inspected).toBe(false);
    expect(persistentStorageValidated).toBe(false);
    expect(schemaVersion()).toBe(16);
  });
});
