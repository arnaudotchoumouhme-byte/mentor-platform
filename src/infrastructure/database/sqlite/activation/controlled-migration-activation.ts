import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import path from "node:path";
import type { SqliteExecutor } from "../sqlite-executor";
import type { VerifiedBackup } from "../backup/backup-model";
import {
  SqliteBackupService,
  sqliteFileStateFingerprint,
} from "../backup/sqlite-backup-service";
import { coreMigrationRegistry } from "../migrations/core-migration-registry";
import { FreshDatabaseBootstrap } from "../migrations/fresh-database-bootstrap";
import { LegacyBaselineAdopter } from "../migrations/legacy-baseline-adopter";
import { LegacySchemaRecognizer } from "../migrations/legacy-schema-recognizer";
import { migrationChecksum } from "../migrations/migration-checksum";
import type { MigrationRegistry } from "../migrations/migration-registry";
import { SqliteSchemaInspector } from "../migrations/sqlite-schema-inspector";
import {
  DatabaseMigrationPreflight,
  type MigrationPreflightResult,
  type MigrationRiskLevel,
} from "../preflight/database-migration-preflight";

const APPROVAL_INTENT = "I_AUTHORIZE_MENTOR_DATABASE_MIGRATION";
const ACTIVATION_TTL_MS = 15 * 60 * 1000;

export type MigrationPlanAction = Readonly<{
  kind: "ADOPT_BASELINE" | "ADOPT_EXISTING" | "EXECUTE";
  migrationId: string;
  checksum: string;
}>;

export type MigrationActivationRequest = Readonly<{
  activationId: string;
  databaseIdentity: Readonly<{ descriptor: string; identityHash: string }>;
  databaseStateFingerprint: string;
  databaseState: string;
  currentVersion: number;
  targetVersion: number;
  actions: readonly MigrationPlanAction[];
  pendingMigrationIds: readonly string[];
  migrationPlanHash: string;
  backup: VerifiedBackup | null;
  backupId: string | null;
  backupChecksum: string | null;
  riskLevel: MigrationRiskLevel;
  createdAt: string;
  expiresAt: string;
  requiresExplicitAuthorization: true;
}>;

export type MigrationAuthorization = Readonly<{
  activationId: string;
  databaseIdentityHash: string;
  migrationPlanHash: string;
  backupId: string | null;
  approvedAt: string;
  approvalIntent: typeof APPROVAL_INTENT;
}>;

export type MigrationActivationAudit = Readonly<{
  activationId: string;
  databaseIdentityDescriptor: string;
  migrationPlanHash: string;
  backupId: string | null;
  migrationIds: readonly string[];
  result: string;
  startedAt: string;
  completedAt: string;
  failureReason: string | null;
}>;

export type MigrationActivationResult =
  | Readonly<{
      status: "MIGRATION_ACTIVATED" | "NO_MIGRATION_REQUIRED";
      activationId: string;
      backupId: string | null;
      fromVersion: number;
      toVersion: number;
      migrationIds: readonly string[];
      verificationStatus: "VERIFIED";
      audit: MigrationActivationAudit;
    }>
  | Readonly<{
      status: "BLOCKED" | "MIGRATION_FAILED_RECOVERY_AVAILABLE" | "MIGRATION_FAILED_MANUAL_RECOVERY_REQUIRED";
      reason: string;
      recovery: "RESTORE_TO_STAGING_AVAILABLE" | "MANUAL_RECOVERY_REQUIRED" | "NONE";
      audit: MigrationActivationAudit;
    }>;

function executor(sqlite: DatabaseSync, readOnly = false): SqliteExecutor {
  return {
    all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
    run: readOnly
      ? () => { throw new Error("Activation preflight executor is read-only."); }
      : (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
  };
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function databaseIdentity(databasePath: string) {
  const resolved = path.resolve(databasePath);
  return Object.freeze({ descriptor: path.basename(resolved), identityHash: hash(resolved) });
}

export class ControlledMigrationActivation {
  constructor(
    private readonly registry: MigrationRegistry = coreMigrationRegistry,
    private readonly backups: SqliteBackupService = new SqliteBackupService(),
    private readonly now: () => Date = () => new Date(),
    private readonly postValidationHook: (databasePath: string) => boolean = () => true,
  ) {}

  async prepare(input: Readonly<{
    databasePath: string;
    backupDestination: string;
    applicationVersion?: string | null;
  }>): Promise<MigrationActivationRequest> {
    const identity = databaseIdentity(input.databasePath);
    const beforeFingerprint = await sqliteFileStateFingerprint(input.databasePath);
    const initial = this.inspect(input.databasePath, null);
    const backupRequired = initial.backupRequirement !== "BACKUP_NOT_REQUIRED";
    const permissibleBackupBlock =
      initial.status === "BLOCKED" &&
      initial.blockers.length === 1 &&
      initial.blockers[0] === "MIGRATION_BACKUP_REQUIRED";
    if (initial.status === "BLOCKED" && !permissibleBackupBlock) {
      throw new Error(`Migration activation preparation blocked (${initial.blockers.join(",")}).`);
    }

    let verifiedBackup: VerifiedBackup | null = null;
    if (backupRequired) {
      const source = new DatabaseSync(input.databasePath, { readOnly: true });
      try {
        source.exec("PRAGMA query_only=ON");
        verifiedBackup = await this.backups.create({
          sourceDatabase: source,
          sourcePath: input.databasePath,
          destinationDirectory: input.backupDestination,
          schemaVersion: initial.currentVersion ?? 0,
          applicationVersion: input.applicationVersion ?? null,
          now: this.now(),
        });
      } finally {
        source.close();
      }
    }

    const stateFingerprint = await sqliteFileStateFingerprint(input.databasePath);
    if (stateFingerprint !== beforeFingerprint) {
      throw new Error("DATABASE_CHANGED_DURING_PREPARATION");
    }
    if (
      verifiedBackup &&
      verifiedBackup.manifest.sourceDatabaseFingerprint !== stateFingerprint
    ) {
      throw new Error("BACKUP_STALE_OR_MISMATCHED");
    }
    const finalPreflight = this.inspect(input.databasePath, verifiedBackup);
    if (
      finalPreflight.status !== "REQUIRES_EXPLICIT_AUTHORIZATION" &&
      finalPreflight.status !== "NO_MIGRATION"
    ) {
      throw new Error(`Migration activation preparation blocked (${finalPreflight.blockers.join(",")}).`);
    }
    const actions = this.plan(input.databasePath, finalPreflight);
    const planHash = this.planHash(identity.identityHash, stateFingerprint, finalPreflight, actions);
    const createdAt = this.now();
    return Object.freeze({
      activationId: randomUUID(),
      databaseIdentity: identity,
      databaseStateFingerprint: stateFingerprint,
      databaseState: finalPreflight.schemaState,
      currentVersion: finalPreflight.currentVersion ?? 0,
      targetVersion: finalPreflight.targetVersion,
      actions,
      pendingMigrationIds: Object.freeze(actions.map(({ migrationId }) => migrationId)),
      migrationPlanHash: planHash,
      backup: verifiedBackup,
      backupId: verifiedBackup?.manifest.backupId ?? null,
      backupChecksum: verifiedBackup?.manifest.databaseChecksum ?? null,
      riskLevel: finalPreflight.riskLevel,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + ACTIVATION_TTL_MS).toISOString(),
      requiresExplicitAuthorization: true,
    });
  }

  async execute(
    databasePath: string,
    request: MigrationActivationRequest,
    authorization: MigrationAuthorization | null,
  ): Promise<MigrationActivationResult> {
    const startedAt = this.now();
    const blocked = (reason: string): MigrationActivationResult => ({
      status: "BLOCKED",
      reason,
      recovery: "NONE",
      audit: this.audit(request, "BLOCKED", startedAt, reason),
    });
    if (!authorization) return blocked("AUTHORIZATION_MISSING");
    if (
      authorization.approvalIntent !== APPROVAL_INTENT ||
      authorization.activationId !== request.activationId ||
      authorization.databaseIdentityHash !== request.databaseIdentity.identityHash ||
      authorization.migrationPlanHash !== request.migrationPlanHash ||
      authorization.backupId !== request.backupId
    ) return blocked("AUTHORIZATION_INVALID");
    const approvedAt = Date.parse(authorization.approvedAt);
    if (
      !Number.isFinite(approvedAt) ||
      approvedAt < Date.parse(request.createdAt) ||
      approvedAt > Date.parse(request.expiresAt) ||
      this.now().getTime() > Date.parse(request.expiresAt)
    ) return blocked("AUTHORIZATION_STALE");
    if (databaseIdentity(databasePath).identityHash !== request.databaseIdentity.identityHash) {
      return blocked("DATABASE_IDENTITY_MISMATCH");
    }
    if (await sqliteFileStateFingerprint(databasePath) !== request.databaseStateFingerprint) {
      return blocked("DATABASE_CHANGED_SINCE_PREFLIGHT");
    }
    let verifiedBackup: VerifiedBackup | null = null;
    if (request.backup) {
      try {
        verifiedBackup = await this.backups.verify(request.backup.packageDirectory);
      } catch {
        return blocked("BACKUP_INVALID");
      }
      if (
        verifiedBackup.manifest.backupId !== request.backupId ||
        verifiedBackup.manifest.databaseChecksum !== request.backupChecksum ||
        verifiedBackup.manifest.sourceDatabaseFingerprint !== request.databaseStateFingerprint
      ) return blocked("BACKUP_STALE_OR_MISMATCHED");
    }
    const current = this.inspect(databasePath, verifiedBackup);
    if (
      current.status !== "REQUIRES_EXPLICIT_AUTHORIZATION" &&
      current.status !== "NO_MIGRATION"
    ) return blocked("PREFLIGHT_STALE");
    const actions = this.plan(databasePath, current);
    const currentPlanHash = this.planHash(
      request.databaseIdentity.identityHash,
      request.databaseStateFingerprint,
      current,
      actions,
    );
    if (currentPlanHash !== request.migrationPlanHash) return blocked("MIGRATION_PLAN_CHANGED");
    if (actions.length === 0) {
      return {
        status: "NO_MIGRATION_REQUIRED",
        activationId: request.activationId,
        backupId: request.backupId,
        fromVersion: request.currentVersion,
        toVersion: request.currentVersion,
        migrationIds: Object.freeze([]),
        verificationStatus: "VERIFIED",
        audit: this.audit(request, "NO_MIGRATION_REQUIRED", startedAt, null),
      };
    }

    const sqlite = new DatabaseSync(databasePath);
    try {
      const db = executor(sqlite);
      if (request.databaseState === "LEGACY_RECOGNIZED") {
        new LegacyBaselineAdopter(db, new LegacySchemaRecognizer(), this.registry).adopt();
      }
      new FreshDatabaseBootstrap(db, this.registry).run();
    } catch {
      return {
        status: request.backup ? "MIGRATION_FAILED_RECOVERY_AVAILABLE" : "MIGRATION_FAILED_MANUAL_RECOVERY_REQUIRED",
        reason: "MIGRATION_FAILED",
        recovery: request.backup ? "RESTORE_TO_STAGING_AVAILABLE" : "MANUAL_RECOVERY_REQUIRED",
        audit: this.audit(request, "MIGRATION_FAILED", startedAt, "MIGRATION_FAILED"),
      };
    } finally {
      sqlite.close();
    }
    const postflight = this.inspect(databasePath, null);
    if (postflight.status !== "NO_MIGRATION" || !this.postValidationHook(databasePath)) {
      return {
        status: request.backup ? "MIGRATION_FAILED_RECOVERY_AVAILABLE" : "MIGRATION_FAILED_MANUAL_RECOVERY_REQUIRED",
        reason: "POST_VALIDATION_FAILED",
        recovery: request.backup ? "RESTORE_TO_STAGING_AVAILABLE" : "MANUAL_RECOVERY_REQUIRED",
        audit: this.audit(request, "POST_VALIDATION_FAILED", startedAt, "POST_VALIDATION_FAILED"),
      };
    }
    return {
      status: "MIGRATION_ACTIVATED",
      activationId: request.activationId,
      backupId: request.backupId,
      fromVersion: request.currentVersion,
      toVersion: postflight.currentVersion ?? request.targetVersion,
      migrationIds: request.pendingMigrationIds,
      verificationStatus: "VERIFIED",
      audit: this.audit(request, "MIGRATION_ACTIVATED", startedAt, null),
    };
  }

  private inspect(databasePath: string, backup: VerifiedBackup | null): MigrationPreflightResult {
    const sqlite = new DatabaseSync(databasePath, { readOnly: true });
    try {
      sqlite.exec("PRAGMA query_only=ON");
      return new DatabaseMigrationPreflight(
        executor(sqlite, true),
        this.registry,
      ).inspect(backup);
    } finally {
      sqlite.close();
    }
  }

  private plan(databasePath: string, preflight: MigrationPreflightResult): readonly MigrationPlanAction[] {
    if (preflight.status === "NO_MIGRATION") return Object.freeze([]);
    const actions: MigrationPlanAction[] = [];
    if (preflight.schemaState === "LEGACY_RECOGNIZED") {
      const sqlite = new DatabaseSync(databasePath, { readOnly: true });
      try {
        const recognition = new LegacySchemaRecognizer().recognize(
          new SqliteSchemaInspector(executor(sqlite, true)).inspect(),
        );
        if (recognition.state !== "RECOGNIZED_LEGACY") throw new Error("PREFLIGHT_STALE");
        const baseline = this.registry.findById("MIG-0001");
        if (!baseline) throw new Error("MIGRATION_PLAN_INVALID");
        actions.push({ kind: "ADOPT_BASELINE", migrationId: baseline.id, checksum: migrationChecksum(baseline) });
        if (recognition.fingerprint.id === "LEGACY_CORE_9_WITH_IMPORT_JOURNAL") {
          const journal = this.registry.findById("MIG-0002");
          if (!journal) throw new Error("MIGRATION_PLAN_INVALID");
          actions.push({ kind: "ADOPT_EXISTING", migrationId: journal.id, checksum: migrationChecksum(journal) });
        }
      } finally {
        sqlite.close();
      }
    }
    const covered = new Set(actions.map(({ migrationId }) => migrationId));
    for (const migration of this.registry.migrations) {
      if (migration.toVersion <= (preflight.currentVersion ?? 0) || covered.has(migration.id)) continue;
      actions.push({ kind: "EXECUTE", migrationId: migration.id, checksum: migrationChecksum(migration) });
    }
    return Object.freeze(actions.map((action) => Object.freeze(action)));
  }

  private planHash(
    identityHash: string,
    stateFingerprint: string,
    preflight: MigrationPreflightResult,
    actions: readonly MigrationPlanAction[],
  ): string {
    return hash({
      identityHash,
      stateFingerprint,
      state: preflight.schemaState,
      sourceVersion: preflight.currentVersion ?? 0,
      targetVersion: preflight.targetVersion,
      actions,
    });
  }

  private audit(
    request: MigrationActivationRequest,
    result: string,
    startedAt: Date,
    failureReason: string | null,
  ): MigrationActivationAudit {
    return Object.freeze({
      activationId: request.activationId,
      databaseIdentityDescriptor: request.databaseIdentity.descriptor,
      migrationPlanHash: request.migrationPlanHash,
      backupId: request.backupId,
      migrationIds: request.pendingMigrationIds,
      result,
      startedAt: startedAt.toISOString(),
      completedAt: this.now().toISOString(),
      failureReason,
    });
  }
}

export const MIGRATION_APPROVAL_INTENT = APPROVAL_INTENT;
