import "server-only";
import { PilotAccessService } from "@/application/pilot/pilot-core";
import { PilotProvisioningService } from "@/application/pilot/pilot-provisioning";
import { config } from "@/infrastructure/config/server-config";
import { createHmac, randomUUID } from "node:crypto";
import { AppError } from "@/shared/errors/app-error";
import { structuredLogger } from "@/infrastructure/observability/structured-logger";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";
import { auth0 } from "./auth0";
import { SqlitePilotRepository } from "./sqlite-pilot-repository";
import { SqlitePilotOwnership } from "./sqlite-pilot-ownership";
const service=new PilotAccessService(new SqlitePilotRepository(sqliteExecutor));
const repository=new SqlitePilotRepository(sqliteExecutor);
const provisioning=new PilotProvisioningService(repository,{next:randomUUID},{now:()=>new Date().toISOString()});
export async function requirePilotIdentity(){
  try { const session=await auth0.getSession(); return service.resolve(session?.user.sub??null); }
  catch(error){ if(error instanceof AppError)throw error; throw new AppError({code:"AUTH_SESSION_UNAVAILABLE",userMessage:"Le service d’authentification est temporairement indisponible.",internalMessage:"Auth0 session resolution failed.",cause:error,category:"external",retriable:true}); }
}
export const pilotAccess=service;
export const pilotOwnership=new SqlitePilotOwnership(sqliteExecutor);
export async function provisionPilotAccount(oidcSubject:string,traceId:string){
  const session=await auth0.getSession(); const actor=session?.user.sub??null;const {auditKey,osceSessionLimit,aiRequestLimit,quotaWindowDays}=config.pilot;
  const fingerprint=actor&&auditKey?createHmac("sha256",auditKey).update(actor).digest("hex"):undefined;
  try{
    if(!actor)throw new AppError({code:"UNAUTHORIZED",userMessage:"Authentification requise.",category:"security"});
    if(!config.pilot.provisionerSubjects.includes(actor))throw new AppError({code:"PILOT_ACCESS_DENIED",userMessage:"Accès au provisioning refusé.",category:"security"});
    if(!fingerprint||osceSessionLimit===null||aiRequestLimit===null||quotaWindowDays===null)throw new AppError({code:"CFG_PILOT_PROVISIONING_INCOMPLETE",userMessage:"Configuration de provisioning indisponible.",category:"configuration"});
    const result=await provisioning.provision({oidcSubject,actorSubjectFingerprint:fingerprint,traceId,osceSessionLimit,aiRequestLimit,quotaWindowDays});
    structuredLogger.log({level:"info",module:"pilot-provisioning",operation:"account.provision",status:"success",message:result.outcome,traceId,context:{accountId:result.account.accountId,actorFingerprint:fingerprint}});return result;
  }catch(error){structuredLogger.log({level:"warn",module:"pilot-provisioning",operation:"account.provision",status:"failure",message:"Provisioning refused or failed",traceId,errorCode:error instanceof AppError?error.code:"INTERNAL_ERROR",context:{actorFingerprint:fingerprint}});throw error;}
}
export async function meterOsceSession<T>(identity: Awaited<ReturnType<typeof requirePilotIdentity>>, traceId: string, operation: () => Promise<T>): Promise<T> {
  const started=Date.now(); await service.consume(identity,"OSCE_SESSION",new Date().toISOString());
  try { const result=await operation(); await service.record(identity,{usageId:crypto.randomUUID(),feature:"OSCE_SESSION",provider:null,model:null,inputUnits:null,outputUnits:null,estimatedCost:null,durationMs:Date.now()-started,success:true,traceId,createdAt:new Date().toISOString()}); return result; }
  catch(error){await service.record(identity,{usageId:crypto.randomUUID(),feature:"OSCE_SESSION",provider:null,model:null,inputUnits:null,outputUnits:null,estimatedCost:null,durationMs:Date.now()-started,success:false,traceId,createdAt:new Date().toISOString()});throw error;}
}
export async function meterAiRequest<T>(identity: Awaited<ReturnType<typeof requirePilotIdentity>>, traceId: string, operation: () => Promise<T>): Promise<T> {
  const started=Date.now(); await service.consume(identity,"AI_REQUEST",new Date().toISOString());
  try { const result=await operation(); await service.record(identity,{usageId:crypto.randomUUID(),feature:"AI_REQUEST",provider:null,model:null,inputUnits:null,outputUnits:null,estimatedCost:null,durationMs:Date.now()-started,success:true,traceId,createdAt:new Date().toISOString()}); return result; }
  catch(error){await service.record(identity,{usageId:crypto.randomUUID(),feature:"AI_REQUEST",provider:null,model:null,inputUnits:null,outputUnits:null,estimatedCost:null,durationMs:Date.now()-started,success:false,traceId,createdAt:new Date().toISOString()});throw error;}
}
