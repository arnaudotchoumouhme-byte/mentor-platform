import { NextResponse } from "next/server";
import { z } from "zod";
import type { PilotProvisioningResult } from "@/application/pilot/pilot-provisioning";
import { mapErrorToHttp } from "@/presentation/api/http-error-mapper";
import { resolveTraceId } from "@/shared/observability/trace-id";
import { AppError } from "@/shared/errors/app-error";

export const runtime="nodejs"; export const dynamic="force-dynamic";
const bodySchema=z.object({oidcSubject:z.string().trim().min(3).max(255)}).strict();
export function createProvisionAccountPost(provision:(oidcSubject:string,traceId:string)=>Promise<PilotProvisioningResult>){return async(request:Request)=>{const traceId=resolveTraceId(request.headers.get("x-trace-id"));try{let body:unknown;try{body=await request.json();}catch{throw new AppError({code:"VALIDATION_ERROR",userMessage:"Requête de provisioning invalide.",category:"validation"});}const parsed=bodySchema.safeParse(body);if(!parsed.success)throw new AppError({code:"VALIDATION_ERROR",userMessage:"Requête de provisioning invalide.",category:"validation"});const result=await provision(parsed.data.oidcSubject,traceId);return NextResponse.json({success:true,data:{accountId:result.account.accountId,learnerId:result.account.learnerId,status:result.account.status,outcome:result.outcome}},{status:result.outcome==="CREATED"?201:200,headers:{"x-trace-id":traceId,"cache-control":"no-store"}});}catch(error){const mapped=mapErrorToHttp(error,traceId);return NextResponse.json(mapped.body,{status:mapped.status,headers:{"x-trace-id":traceId,"cache-control":"no-store"}});}};}
export const POST=createProvisionAccountPost(async(subject,traceId)=>(await import("@/infrastructure/pilot/server-pilot")).provisionPilotAccount(subject,traceId));
