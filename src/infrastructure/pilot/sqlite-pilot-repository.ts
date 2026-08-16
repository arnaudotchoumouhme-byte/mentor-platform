import type { PilotAccount, PilotRepository, QuotaType, UsageRecord } from "@/application/pilot/pilot-core";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";

type AccountRow={account_id:string;oidc_subject:string;learner_id:string;status:PilotAccount["status"];created_at:string;updated_at:string};
type UsageRow={usage_id:string;account_id:string;feature:string;provider:string|null;model:string|null;input_units:number|null;output_units:number|null;estimated_cost:number|null;duration_ms:number|null;success:number;trace_id:string;created_at:string};
export class SqlitePilotRepository implements PilotRepository {
  constructor(private readonly db:SqliteExecutor){}
  async findAccountBySubject(subject:string){const x=this.db.all<AccountRow>("SELECT * FROM accounts WHERE oidc_subject=?",subject)[0];return x?{accountId:x.account_id,oidcSubject:x.oidc_subject,learnerId:x.learner_id,status:x.status,createdAt:x.created_at,updatedAt:x.updated_at}:null;}
  async consumeQuota(accountId:string,type:QuotaType,now:string){const result=this.db.run("UPDATE usage_quotas SET consumed_value=consumed_value+1 WHERE account_id=? AND quota_type=? AND window_start<=? AND window_end>? AND consumed_value<limit_value",accountId,type,now,now);return Number(result.changes)===1;}
  async appendUsage(x:UsageRecord){this.db.run("INSERT INTO usage_ledger VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",x.usageId,x.accountId,x.feature,x.provider,x.model,x.inputUnits,x.outputUnits,x.estimatedCost,x.durationMs,x.success?1:0,x.traceId,x.createdAt);}
  async listUsage(accountId:string){return this.db.all<UsageRow>("SELECT * FROM usage_ledger WHERE account_id=? ORDER BY created_at,usage_id",accountId).map(x=>({usageId:x.usage_id,accountId:x.account_id,feature:x.feature,provider:x.provider,model:x.model,inputUnits:x.input_units,outputUnits:x.output_units,estimatedCost:x.estimated_cost,durationMs:x.duration_ms,success:x.success===1,traceId:x.trace_id,createdAt:x.created_at}));}
}
