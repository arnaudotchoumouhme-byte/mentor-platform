import { AppError } from "@/shared/errors/app-error";
import type { PilotAccount, QuotaType } from "./pilot-core";

export type PilotQuotaProvision = Readonly<{ quotaId:string; type:QuotaType; windowStart:string; windowEnd:string; limit:number }>;
export type PilotProvisioningRecord = Readonly<{ auditId:string; actorSubjectFingerprint:string; traceId:string; createdAt:string }>;
export type PilotProvisioningResult = Readonly<{ account:PilotAccount; outcome:"CREATED"|"ALREADY_PROVISIONED" }>;
export interface PilotProvisioningRepository {
  provisionActiveAccount(input: Readonly<{ account:PilotAccount; quotas:readonly PilotQuotaProvision[]; audit:PilotProvisioningRecord }>): Promise<PilotProvisioningResult>;
}

const SUBJECT_PATTERN = /^[^\u0000-\u001f\u007f]{3,255}$/;

export class PilotProvisioningService {
  constructor(private readonly repository:PilotProvisioningRepository, private readonly ids:Readonly<{next:()=>string}>, private readonly clock:Readonly<{now:()=>string}>) {}
  async provision(input:Readonly<{oidcSubject:string;actorSubjectFingerprint:string;traceId:string;osceSessionLimit:number;aiRequestLimit:number;quotaWindowDays:number}>):Promise<PilotProvisioningResult>{
    const oidcSubject=input.oidcSubject.trim();
    if(!SUBJECT_PATTERN.test(oidcSubject)||!input.actorSubjectFingerprint||!input.traceId||input.osceSessionLimit<0||input.aiRequestLimit<0||input.quotaWindowDays<1) throw new AppError({code:"VALIDATION_ERROR",userMessage:"Paramètres de provisioning invalides.",category:"validation"});
    const createdAt=this.clock.now(); const start=new Date(createdAt); start.setUTCHours(0,0,0,0); const end=new Date(start); end.setUTCDate(end.getUTCDate()+input.quotaWindowDays);
    const account:PilotAccount = Object.freeze({accountId:this.ids.next(),oidcSubject,learnerId:this.ids.next(),status:"ACTIVE",createdAt,updatedAt:createdAt});
    return this.repository.provisionActiveAccount({account,quotas:Object.freeze([
      {quotaId:this.ids.next(),type:"OSCE_SESSION",windowStart:start.toISOString(),windowEnd:end.toISOString(),limit:input.osceSessionLimit},
      {quotaId:this.ids.next(),type:"AI_REQUEST",windowStart:start.toISOString(),windowEnd:end.toISOString(),limit:input.aiRequestLimit},
    ]),audit:{auditId:this.ids.next(),actorSubjectFingerprint:input.actorSubjectFingerprint,traceId:input.traceId,createdAt}});
  }
}
