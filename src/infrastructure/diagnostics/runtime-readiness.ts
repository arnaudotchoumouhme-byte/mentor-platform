import "server-only";

export type ReadinessCheckStatus = "ready" | "not-ready" | "disabled";
export type RuntimeReadiness = Readonly<{
  status: "ready" | "not-ready";
  checks: Readonly<{
    persistentStorage: ReadinessCheckStatus;
    database: ReadinessCheckStatus;
    schema: Readonly<{ status: ReadinessCheckStatus; currentVersion: number | null; targetVersion: number }>;
    migrations: Readonly<{ status: ReadinessCheckStatus; pending: number }>;
    auth0: ReadinessCheckStatus;
    foundation: ReadinessCheckStatus;
    mcq: ReadinessCheckStatus;
    osce: ReadinessCheckStatus;
    calculations: ReadinessCheckStatus;
    imports: ReadinessCheckStatus;
    ai: ReadinessCheckStatus;
  }>;
}>;

export type RuntimeReadinessInput = Readonly<{
  persistentStorageReady: boolean;
  databaseAvailable: boolean;
  schemaVersion: number | null;
  targetVersion: number;
  pendingMigrations: number;
  schemaValid: boolean;
  auth0Configured: boolean;
  aiConfigured: boolean;
}>;

export function evaluateRuntimeReadiness(input: RuntimeReadinessInput): RuntimeReadiness {
  const schemaReady = input.databaseAvailable && input.schemaValid && input.schemaVersion === input.targetVersion;
  const migrationsReady = schemaReady && input.pendingMigrations === 0;
  const indispensableReady = input.persistentStorageReady && input.databaseAvailable && schemaReady && migrationsReady && input.auth0Configured;
  const moduleStatus: ReadinessCheckStatus = schemaReady ? "ready" : "not-ready";
  return Object.freeze({
    status: indispensableReady ? "ready" : "not-ready",
    checks: Object.freeze({
      persistentStorage: input.persistentStorageReady ? "ready" : "not-ready",
      database: input.databaseAvailable ? "ready" : "not-ready",
      schema: Object.freeze({ status: schemaReady ? "ready" : "not-ready", currentVersion: input.schemaVersion, targetVersion: input.targetVersion }),
      migrations: Object.freeze({ status: migrationsReady ? "ready" : "not-ready", pending: input.pendingMigrations }),
      auth0: input.auth0Configured ? "ready" : "not-ready",
      foundation: moduleStatus,
      mcq: moduleStatus,
      osce: moduleStatus,
      calculations: moduleStatus,
      imports: moduleStatus,
      ai: input.aiConfigured ? "ready" : "disabled",
    }),
  });
}
