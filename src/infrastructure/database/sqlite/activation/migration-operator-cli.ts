import { execFileSync } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ControlledMigrationActivation,
  MIGRATION_APPROVAL_INTENT,
  type MigrationActivationRequest,
  type MigrationAuthorization,
} from "./controlled-migration-activation";
import { inspectDatabaseFileReadOnly } from "../preflight/database-migration-preflight";

export const BACKUP_APPROVAL_INTENT = "I_AUTHORIZE_MENTOR_DATABASE_BACKUP";

type OperatorIo = Readonly<{
  log(value: string): void;
  error(value: string): void;
}>;

type OperatorDependencies = Readonly<{
  activation: ControlledMigrationActivation;
  inspect: typeof inspectDatabaseFileReadOnly;
  validatePersistentStorage(environment: NodeJS.ProcessEnv): void;
}>;

class OperatorError extends Error {
  constructor(readonly code: string) { super(code); }
}

const defaultDependencies = (): OperatorDependencies => ({
  activation: new ControlledMigrationActivation(),
  inspect: inspectDatabaseFileReadOnly,
  validatePersistentStorage: environment => {
    execFileSync(process.execPath, [path.join(process.cwd(), "scripts", "check-persistent-storage.mjs")], {
      env: environment,
      stdio: "inherit",
    });
  },
});

function options(values: readonly string[]): ReadonlyMap<string, string> {
  const parsed = new Map<string, string>();
  for (const value of values) {
    const separator = value.indexOf("=");
    if (!value.startsWith("--") || separator < 3) throw new OperatorError("MIGRATION_OPERATOR_ARGUMENT_INVALID");
    const key = value.slice(0, separator);
    if (parsed.has(key)) throw new OperatorError("MIGRATION_OPERATOR_ARGUMENT_DUPLICATE");
    parsed.set(key, value.slice(separator + 1));
  }
  return parsed;
}

function required(values: ReadonlyMap<string, string>, key: string): string {
  const value = values.get(key)?.trim();
  if (!value) throw new OperatorError(`MIGRATION_OPERATOR_REQUIRED:${key}`);
  return value;
}

function exactKeys(values: ReadonlyMap<string, string>, allowed: readonly string[]): void {
  const expected = new Set(allowed);
  if ([...values.keys()].some(key => !expected.has(key))) throw new OperatorError("MIGRATION_OPERATOR_ARGUMENT_UNKNOWN");
}

function absolute(value: string, code: string): string {
  if (!path.isAbsolute(value)) throw new OperatorError(code);
  return path.resolve(value);
}

function within(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function validateTarget(databasePath: string, artifactPaths: readonly string[], environment: NodeJS.ProcessEnv, dependencies: OperatorDependencies): void {
  const persistentStorageRequired =
    (environment.NODE_ENV === "production" && environment.RENDER === "true") ||
    environment.MENTOR_REQUIRE_PERSISTENT_STORAGE === "1";
  if (!persistentStorageRequired) return;
  const mount = environment.MENTOR_PERSISTENT_MOUNT_PATH;
  const data = environment.MENTOR_DATA_DIRECTORY;
  if (!mount || !data || !path.isAbsolute(mount) || !path.isAbsolute(data)) throw new OperatorError("MIGRATION_OPERATOR_PERSISTENT_PATH_REQUIRED");
  const resolvedMount = path.resolve(mount);
  const resolvedData = path.resolve(data);
  if (!within(resolvedMount, resolvedData)) throw new OperatorError("MIGRATION_OPERATOR_DATA_OUTSIDE_MOUNT");
  if (databasePath !== path.join(resolvedData, "mentor.db")) throw new OperatorError("MIGRATION_OPERATOR_DATABASE_TARGET_MISMATCH");
  if (artifactPaths.some(candidate => !within(resolvedMount, candidate))) throw new OperatorError("MIGRATION_OPERATOR_ARTIFACT_OUTSIDE_MOUNT");
  dependencies.validatePersistentStorage(environment);
}

async function ensureNewFile(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    return;
  }
  throw new OperatorError("MIGRATION_OPERATOR_OUTPUT_ALREADY_EXISTS");
}

function parseRequest(value: unknown): MigrationActivationRequest {
  const candidate = value as Partial<MigrationActivationRequest> | null;
  if (
    !candidate || typeof candidate !== "object" || typeof candidate.activationId !== "string" ||
    typeof candidate.databaseIdentity?.identityHash !== "string" || typeof candidate.databaseStateFingerprint !== "string" ||
    typeof candidate.migrationPlanHash !== "string" || !Array.isArray(candidate.actions) || !Array.isArray(candidate.pendingMigrationIds) ||
    typeof candidate.currentVersion !== "number" || typeof candidate.targetVersion !== "number" || candidate.requiresExplicitAuthorization !== true
  ) throw new OperatorError("MIGRATION_OPERATOR_REQUEST_INVALID");
  return candidate as MigrationActivationRequest;
}

function parseAuthorization(value: unknown): MigrationAuthorization {
  const candidate = value as Partial<MigrationAuthorization> | null;
  if (
    !candidate || typeof candidate !== "object" || typeof candidate.activationId !== "string" ||
    typeof candidate.databaseIdentityHash !== "string" || typeof candidate.migrationPlanHash !== "string" ||
    typeof candidate.approvedAt !== "string" || candidate.approvalIntent !== MIGRATION_APPROVAL_INTENT ||
    !(candidate.backupId === null || typeof candidate.backupId === "string")
  ) throw new OperatorError("MIGRATION_OPERATOR_AUTHORIZATION_INVALID");
  return candidate as MigrationAuthorization;
}

async function readJson(filePath: string): Promise<unknown> {
  try { return JSON.parse(await readFile(filePath, "utf8")) as unknown; }
  catch { throw new OperatorError("MIGRATION_OPERATOR_JSON_INVALID"); }
}

export async function runMigrationOperator(
  argv: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
  io: OperatorIo = console,
  dependencies: OperatorDependencies = defaultDependencies(),
): Promise<number> {
  const phase = argv[0];
  let databaseTarget: string | null = null;
  try {
    const parsed = options(argv.slice(1));
    if (phase === "prepare") {
      exactKeys(parsed, ["--database", "--backup-destination", "--request-output", "--application-version", "--backup-intent"]);
      const databasePath = absolute(required(parsed, "--database"), "MIGRATION_OPERATOR_DATABASE_ABSOLUTE_PATH_REQUIRED");
      const backupDestination = absolute(required(parsed, "--backup-destination"), "MIGRATION_OPERATOR_BACKUP_ABSOLUTE_PATH_REQUIRED");
      const requestOutput = absolute(required(parsed, "--request-output"), "MIGRATION_OPERATOR_REQUEST_ABSOLUTE_PATH_REQUIRED");
      const applicationVersion = required(parsed, "--application-version");
      databaseTarget = databasePath;
      validateTarget(databasePath, [backupDestination, requestOutput], environment, dependencies);
      await ensureNewFile(requestOutput);
      const preflight = dependencies.inspect(databasePath);
      const requiresBackup = preflight.backupRequirement !== "BACKUP_NOT_REQUIRED";
      if (requiresBackup && parsed.get("--backup-intent") !== BACKUP_APPROVAL_INTENT) throw new OperatorError("MIGRATION_OPERATOR_BACKUP_AUTHORIZATION_REQUIRED");
      if (preflight.status === "BLOCKED" && !preflight.blockers.includes("MIGRATION_BACKUP_REQUIRED")) throw new OperatorError(`MIGRATION_OPERATOR_PREFLIGHT_BLOCKED:${preflight.blockers.join(",")}`);
      const request = await dependencies.activation.prepare({ databasePath, backupDestination, applicationVersion });
      await writeFile(requestOutput, `${JSON.stringify(request, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
      io.log(JSON.stringify({ status: "PREPARED", databaseTarget: databasePath, currentVersion: request.currentVersion, targetVersion: request.targetVersion, pendingMigrations: request.pendingMigrationIds, backupId: request.backupId, backupStatus: request.backup?.status ?? null, activationId: request.activationId, migrationPlanHash: request.migrationPlanHash, expiresAt: request.expiresAt, requestFile: requestOutput, authorizationIntentRequired: MIGRATION_APPROVAL_INTENT }));
      return 0;
    }
    if (phase === "apply") {
      exactKeys(parsed, ["--database", "--request", "--authorization"]);
      const databasePath = absolute(required(parsed, "--database"), "MIGRATION_OPERATOR_DATABASE_ABSOLUTE_PATH_REQUIRED");
      const requestPath = absolute(required(parsed, "--request"), "MIGRATION_OPERATOR_REQUEST_ABSOLUTE_PATH_REQUIRED");
      const authorizationPath = absolute(required(parsed, "--authorization"), "MIGRATION_OPERATOR_AUTHORIZATION_ABSOLUTE_PATH_REQUIRED");
      databaseTarget = databasePath;
      const request = parseRequest(await readJson(requestPath));
      const authorization = parseAuthorization(await readJson(authorizationPath));
      const backupPackageDirectory = request.backup
        ? absolute(request.backup.packageDirectory, "MIGRATION_OPERATOR_BACKUP_PACKAGE_ABSOLUTE_PATH_REQUIRED")
        : null;
      validateTarget(
        databasePath,
        backupPackageDirectory ? [requestPath, authorizationPath, backupPackageDirectory] : [requestPath, authorizationPath],
        environment,
        dependencies,
      );
      const result = await dependencies.activation.execute(databasePath, request, authorization);
      io.log(JSON.stringify({ ...result, databaseTarget: databasePath }));
      return result.status === "MIGRATION_ACTIVATED" || result.status === "NO_MIGRATION_REQUIRED" ? 0 : 3;
    }
    throw new OperatorError("MIGRATION_OPERATOR_PHASE_REQUIRED:prepare|apply");
  } catch (cause) {
    const code = cause instanceof OperatorError ? cause.code : "MIGRATION_OPERATOR_FAILED";
    io.error(JSON.stringify({ status: "BLOCKED", code, databaseTarget }));
    return 2;
  }
}
