import { NextResponse } from "next/server";
import { z } from "zod";
import type { UseCase } from "@/application/contracts";
import type { CreateMcqSessionInput } from "@/application/mcq/create-mcq-session";
import type { PilotIdentity } from "@/application/pilot/pilot-core";
import { apiErrorResponse, apiValidationError } from "@/infrastructure/observability/api-boundary";
import { resolveTraceId } from "@/shared/observability/trace-id";

const constraint=z.object({dimension:z.enum(["domain","competency","topic","objective"]),id:z.string().trim().min(1).max(200),minimum:z.number().int().min(0).max(500)});
const schema=z.object({mode:z.enum(["STUDY","QUIZ"]),count:z.number().int().min(1).max(500),seed:z.string().trim().min(1).max(200),blueprintVersionId:z.string().trim().min(1).max(200),difficulties:z.array(z.enum(["FOUNDATION","INTERMEDIATE","ADVANCED"])).max(3).optional(),constraints:z.array(constraint).max(100).optional()});
const invalid=(traceId:string)=>apiValidationError("Requête MCQ invalide.",{traceId,module:"mcq",operation:"mcq.session.create"});

export function createSessionsPost(load:()=>Promise<UseCase<CreateMcqSessionInput,unknown>>,identity:()=>Promise<PilotIdentity>,bind:(sessionId:string,learnerId:string)=>Promise<void>){return async(request:Request)=>{const traceId=resolveTraceId(request.headers.get("x-trace-id"));let body:unknown;try{body=await request.json();}catch{return invalid(traceId);}const parsed=schema.safeParse(body);if(!parsed.success)return invalid(traceId);try{const caller=await identity();const result=await(await load()).execute({...parsed.data,traceId});await bind((result as {sessionId:string}).sessionId,caller.learnerId);return NextResponse.json(result,{status:201,headers:{"x-trace-id":traceId}});}catch(error){return apiErrorResponse(error,{traceId,module:"mcq",operation:"mcq.session.create"});}};}

export const POST=createSessionsPost(async()=>(await import("@/infrastructure/mcq/server-mcq")).mcqServices.create,async()=>(await import("@/infrastructure/pilot/server-pilot")).requirePilotIdentity(),async(sessionId,learnerId)=>(await import("@/infrastructure/pilot/server-pilot")).pilotOwnership.bindMcqSession(sessionId,learnerId));
