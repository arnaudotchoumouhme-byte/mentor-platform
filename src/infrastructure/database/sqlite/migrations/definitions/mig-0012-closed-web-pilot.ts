import type {SqliteExecutor} from "../../sqlite-executor";
import {MigrationError} from "../migration-errors";
import {SqliteSchemaInspector} from "../sqlite-schema-inspector";
export const PILOT_TABLE_NAMES=["accounts","usage_quotas","usage_ledger"] as const;
export const PILOT_STATEMENTS=[
`CREATE TABLE accounts (account_id TEXT PRIMARY KEY, oidc_subject TEXT NOT NULL UNIQUE, learner_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL CHECK(status IN ('ACTIVE','DISABLED')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
`CREATE INDEX accounts_status ON accounts(status,created_at)`,
`CREATE TABLE usage_quotas (quota_id TEXT PRIMARY KEY, account_id TEXT NOT NULL, quota_type TEXT NOT NULL CHECK(quota_type IN ('OSCE_SESSION','AI_REQUEST')), window_start TEXT NOT NULL, window_end TEXT NOT NULL, limit_value INTEGER NOT NULL CHECK(limit_value>=0), consumed_value INTEGER NOT NULL DEFAULT 0 CHECK(consumed_value>=0 AND consumed_value<=limit_value), UNIQUE(account_id,quota_type,window_start), CHECK(window_end>window_start), FOREIGN KEY(account_id) REFERENCES accounts(account_id) ON DELETE RESTRICT)`,
`CREATE INDEX usage_quotas_active ON usage_quotas(account_id,quota_type,window_end)`,
`CREATE TABLE usage_ledger (usage_id TEXT PRIMARY KEY, account_id TEXT NOT NULL, feature TEXT NOT NULL, provider TEXT, model TEXT, input_units INTEGER CHECK(input_units IS NULL OR input_units>=0), output_units INTEGER CHECK(output_units IS NULL OR output_units>=0), estimated_cost REAL CHECK(estimated_cost IS NULL OR estimated_cost>=0), duration_ms INTEGER CHECK(duration_ms IS NULL OR duration_ms>=0), success INTEGER NOT NULL CHECK(success IN (0,1)), trace_id TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(account_id) REFERENCES accounts(account_id) ON DELETE RESTRICT)`,
`CREATE INDEX usage_ledger_account_time ON usage_ledger(account_id,created_at)`,
`ALTER TABLE mcq_sessions ADD COLUMN learner_id TEXT`,
`CREATE INDEX mcq_sessions_learner_status ON mcq_sessions(learner_id,status,started_at)`,
] as const;
export function assertPilotSchema(db:SqliteExecutor){const tables=new Map(new SqliteSchemaInspector(db).inspect().tables.map(x=>[x.name,x]));if(PILOT_TABLE_NAMES.some(x=>!tables.has(x))||tables.get("usage_quotas")?.foreignKeys.length!==1||tables.get("usage_ledger")?.foreignKeys.length!==1||!tables.get("mcq_sessions")?.columns.some(x=>x.name==="learner_id"))throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED","Closed Web Pilot schema is incomplete.");}
export const closedWebPilotMigration={id:"MIG-0012",fromVersion:11,toVersion:12,description:"Create Closed Web Pilot accounts, quotas and usage ledger",checksumMaterial:[...PILOT_STATEMENTS,"postcondition:closed-web-pilot-v1"],up:(db:SqliteExecutor)=>{for(const x of PILOT_STATEMENTS)db.run(x);},validate:assertPilotSchema} as const;
