import type { PilotAccount, PilotRepository, QuotaType, UsageRecord } from "@/application/pilot/pilot-core";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { AppError } from "@/shared/errors/app-error";
import type { PilotProvisioningRepository, PilotProvisioningResult } from "@/application/pilot/pilot-provisioning";

type AccountRow={account_id:string;oidc_subject:string;learner_id:string;status:PilotAccount["status"];created_at:string;updated_at:string};
type UsageRow={usage_id:string;account_id:string;feature:string;provider:string|null;model:string|null;input_units:number|null;output_units:number|null;estimated_cost:number|null;duration_ms:number|null;success:number;trace_id:string;created_at:string};
export class SqlitePilotRepository implements PilotRepository, PilotProvisioningRepository {
  constructor(private readonly db:SqliteExecutor){}
  async findAccountBySubject(subject:string){const x=this.db.all<AccountRow>("SELECT * FROM accounts WHERE oidc_subject=?",subject)[0];return x?{accountId:x.account_id,oidcSubject:x.oidc_subject,learnerId:x.learner_id,status:x.status,createdAt:x.created_at,updatedAt:x.updated_at}:null;}
  async consumeQuota(accountId:string,type:QuotaType,now:string){try{const result=this.db.run("UPDATE usage_quotas SET consumed_value=consumed_value+1 WHERE account_id=? AND quota_type=? AND window_start<=? AND window_end>? AND consumed_value<limit_value",accountId,type,now,now);return Number(result.changes)===1;}catch(error){throw new AppError({code:"DB_QUOTA_UPDATE_FAILED",userMessage:"Le quota ne peut pas être vérifié actuellement.",internalMessage:"SQLite quota update failed.",cause:error,category:"database",retriable:true});}}
  async appendUsage(x:UsageRecord){this.db.run("INSERT INTO usage_ledger VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",x.usageId,x.accountId,x.feature,x.provider,x.model,x.inputUnits,x.outputUnits,x.estimatedCost,x.durationMs,x.success?1:0,x.traceId,x.createdAt);}
  async listUsage(accountId:string){return this.db.all<UsageRow>("SELECT * FROM usage_ledger WHERE account_id=? ORDER BY created_at,usage_id",accountId).map(x=>({usageId:x.usage_id,accountId:x.account_id,feature:x.feature,provider:x.provider,model:x.model,inputUnits:x.input_units,outputUnits:x.output_units,estimatedCost:x.estimated_cost,durationMs:x.duration_ms,success:x.success===1,traceId:x.trace_id,createdAt:x.created_at}));}
  async provisionActiveAccount(input:Parameters<PilotProvisioningRepository["provisionActiveAccount"]>[0]):Promise<PilotProvisioningResult>{
    this.db.run("BEGIN IMMEDIATE");
    try {
      const version=this.db.all<{version:number|null}>("SELECT MAX(to_version) AS version FROM schema_migrations")[0]?.version??null;
      if(version!==13)throw new AppError({code:"DB_SCHEMA_OUTDATED",userMessage:"Le schéma de provisioning n’est pas prêt.",category:"database"});
      const existing=await this.findAccountBySubject(input.account.oidcSubject);
      if(existing?.status==="DISABLED")throw new AppError({code:"CONFLICT",userMessage:"Le compte pilote est désactivé et ne peut pas être réactivé automatiquement.",category:"security"});
      const account=existing??input.account;
      if(!existing)this.db.run("INSERT INTO accounts(account_id,oidc_subject,learner_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?)",account.accountId,account.oidcSubject,account.learnerId,account.status,account.createdAt,account.updatedAt);
      for(const quota of input.quotas)this.db.run("INSERT OR IGNORE INTO usage_quotas(quota_id,account_id,quota_type,window_start,window_end,limit_value,consumed_value) VALUES(?,?,?,?,?,?,0)",quota.quotaId,account.accountId,quota.type,quota.windowStart,quota.windowEnd,quota.limit);
      const outcome=existing?"ALREADY_PROVISIONED":"CREATED";
      this.db.run("INSERT INTO pilot_account_provisioning_audit(audit_id,action,outcome,actor_subject_fingerprint,target_account_id,trace_id,created_at) VALUES(?,'ACCOUNT_PROVISION',?,?,?,?,?)",input.audit.auditId,outcome,input.audit.actorSubjectFingerprint,account.accountId,input.audit.traceId,input.audit.createdAt);
      this.db.run("COMMIT"); return Object.freeze({account,outcome});
    }catch(error){this.db.run("ROLLBACK");throw error;}
  }
}
