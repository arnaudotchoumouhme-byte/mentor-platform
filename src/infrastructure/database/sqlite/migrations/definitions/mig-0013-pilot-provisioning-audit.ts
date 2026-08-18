import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";
import { SqliteSchemaInspector } from "../sqlite-schema-inspector";

export const PILOT_PROVISIONING_AUDIT_TABLE_NAMES = ["pilot_account_provisioning_audit"] as const;
export const PILOT_PROVISIONING_AUDIT_STATEMENTS = [
  `CREATE TABLE pilot_account_provisioning_audit (
    audit_id TEXT PRIMARY KEY,
    action TEXT NOT NULL CHECK(action='ACCOUNT_PROVISION'),
    outcome TEXT NOT NULL CHECK(outcome IN ('CREATED','ALREADY_PROVISIONED')),
    actor_subject_fingerprint TEXT NOT NULL,
    target_account_id TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(target_account_id) REFERENCES accounts(account_id) ON DELETE RESTRICT
  )`,
  `CREATE INDEX pilot_provisioning_audit_account_time ON pilot_account_provisioning_audit(target_account_id,created_at)`,
] as const;

export function assertPilotProvisioningAuditSchema(database: SqliteExecutor): void {
  const table = new SqliteSchemaInspector(database).inspect().tables.find(item => item.name === "pilot_account_provisioning_audit");
  if (!table || table.foreignKeys.length !== 1 || !table.indexes.some(index => index.name === "pilot_provisioning_audit_account_time")) {
    throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "Pilot provisioning audit schema is incomplete.");
  }
}

export const pilotProvisioningAuditMigration = {
  id: "MIG-0013",
  fromVersion: 12,
  toVersion: 13,
  description: "Create append-only pilot account provisioning audit",
  checksumMaterial: [...PILOT_PROVISIONING_AUDIT_STATEMENTS, "postcondition:pilot-provisioning-audit-v1"],
  up: (database: SqliteExecutor): void => { for (const statement of PILOT_PROVISIONING_AUDIT_STATEMENTS) database.run(statement); },
  validate: assertPilotProvisioningAuditSchema,
} as const;
