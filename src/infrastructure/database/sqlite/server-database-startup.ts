import type { SqliteExecutor } from "./sqlite-executor";
import {
  inspectDatabaseFileReadOnly,
  type MigrationPreflightResult,
} from "./preflight/database-migration-preflight";
import {
  DatabaseReadinessOrchestrator,
  type DatabaseReadinessResult,
} from "./migrations/database-readiness-orchestrator";

export class DatabaseNotReadyError extends Error {
  constructor(readonly readiness: Extract<DatabaseReadinessResult, { status: "BLOCKED" }>) {
    super(readiness.safeDiagnostic);
    this.name = "DatabaseNotReadyError";
  }
}

export class DatabaseMigrationAuthorizationRequiredError extends Error {
  constructor(readonly preflight: MigrationPreflightResult) {
    super("Existing database requires controlled migration authorization before startup.");
    this.name = "DatabaseMigrationAuthorizationRequiredError";
  }
}

export function requireExistingDatabaseIsCurrent(databasePath: string): MigrationPreflightResult {
  const preflight = inspectDatabaseFileReadOnly(databasePath);
  if (preflight.status !== "NO_MIGRATION") {
    throw new DatabaseMigrationAuthorizationRequiredError(preflight);
  }
  return preflight;
}

export function establishDatabaseReadiness(database: SqliteExecutor): DatabaseReadinessResult {
  return new DatabaseReadinessOrchestrator(database).ensureReady();
}

export function requireDatabaseReadiness(database: SqliteExecutor): DatabaseReadinessResult {
  const result = establishDatabaseReadiness(database);
  if (result.status === "BLOCKED") throw new DatabaseNotReadyError(result);
  return result;
}

export function initializeAfterDatabaseReadiness<T>(
  database: SqliteExecutor,
  initialize: () => T,
): Readonly<{ readiness: Extract<DatabaseReadinessResult, { status: "READY" }>; value: T }> {
  const readiness = requireDatabaseReadiness(database);
  if (readiness.status !== "READY") {
    throw new DatabaseNotReadyError(readiness);
  }
  return Object.freeze({ readiness, value: initialize() });
}
