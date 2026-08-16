import "server-only";
import { PilotAccessService } from "@/application/pilot/pilot-core";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";
import { auth0 } from "./auth0";
import { SqlitePilotRepository } from "./sqlite-pilot-repository";
import { SqlitePilotOwnership } from "./sqlite-pilot-ownership";
const service=new PilotAccessService(new SqlitePilotRepository(sqliteExecutor));
export async function requirePilotIdentity(){const session=await auth0.getSession();return service.resolve(session?.user.sub??null);}
export const pilotAccess=service;
export const pilotOwnership=new SqlitePilotOwnership(sqliteExecutor);
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
