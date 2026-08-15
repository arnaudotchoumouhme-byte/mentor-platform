import { NextResponse } from "next/server";
import { z } from "zod";
import type { CalculationsApi } from "@/infrastructure/calculations/server-calculations";
import { mapErrorToHttp } from "@/presentation/api/http-error-mapper";
import { apiSuccess } from "@/shared/api/contracts";
import { resolveTraceId } from "@/shared/observability/trace-id";
export const runtime="nodejs";export const dynamic="force-dynamic";
const uuid=z.string().uuid();const quantity=z.object({value:z.number().finite(),unit:z.enum(["mg","g","mL","L"])}).strict();
const mutation=z.discriminatedUnion("action",[
  z.object({action:z.literal("submit"),learnerId:uuid,exerciseVersionId:uuid,steps:z.array(quantity).min(1),result:quantity}).strict(),
  z.object({action:z.literal("prepareRetest"),sourceAttemptId:uuid,exerciseVersionId:uuid}).strict(),
]);
const invalid=(traceId:string)=>NextResponse.json({success:false,error:{code:"VALIDATION_ERROR",message:"Requête Calculations Lab invalide."}},{status:400,headers:{"x-trace-id":traceId}});
const respond=async(traceId:string,operation:()=>Promise<unknown>,status=200)=>{try{return NextResponse.json(apiSuccess(await operation()),{status,headers:{"x-trace-id":traceId,"cache-control":"no-store"}});}catch(error){const mapped=mapErrorToHttp(error);return NextResponse.json(mapped.body,{status:mapped.status,headers:{"x-trace-id":traceId,"cache-control":"no-store"}});}};
export function createCalculationsHandlers(load:()=>Promise<CalculationsApi>){return{GET:async(request:Request)=>{const traceId=resolveTraceId(request.headers.get("x-trace-id"));const parsed=uuid.safeParse(new URL(request.url).searchParams.get("exerciseVersionId"));if(!parsed.success)return invalid(traceId);return respond(traceId,async()=>(await load()).exercise.execute(parsed.data,traceId));},POST:async(request:Request)=>{const traceId=resolveTraceId(request.headers.get("x-trace-id"));let body:unknown;try{body=await request.json();}catch{return invalid(traceId);}const parsed=mutation.safeParse(body);if(!parsed.success)return invalid(traceId);const api=await load();const input=parsed.data;if(input.action==="submit")return respond(traceId,()=>api.submit.execute({learnerId:input.learnerId,exerciseVersionId:input.exerciseVersionId,submission:{steps:input.steps,result:input.result},traceId}),201);return respond(traceId,()=>api.retest.execute({sourceAttemptId:input.sourceAttemptId,exerciseVersionId:input.exerciseVersionId,traceId}),201);}};}
const handlers=createCalculationsHandlers(async()=>(await import("@/infrastructure/calculations/server-calculations")).calculationsApi);export const GET=handlers.GET;export const POST=handlers.POST;
