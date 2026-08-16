import {NextResponse} from "next/server";
import {z} from "zod";
import type {OsceApi} from "@/infrastructure/osce/server-osce";
import {mapErrorToHttp} from "@/presentation/api/http-error-mapper";
import {apiSuccess} from "@/shared/api/contracts";
import {resolveTraceId} from "@/shared/observability/trace-id";
export const runtime="nodejs";export const dynamic="force-dynamic";
const uuid=z.string().uuid();const body=z.discriminatedUnion("action",[
 z.object({action:z.literal("start"),learnerId:uuid,stationVersionId:uuid}).strict(),
 z.object({action:z.literal("interact"),sessionId:uuid,callerLearnerId:uuid,roleId:uuid,text:z.string().trim().min(1).max(4000),disclosureId:uuid.nullish()}).strict(),
 z.object({action:z.literal("reveal"),sessionId:uuid,callerLearnerId:uuid,disclosureId:uuid}).strict(),
 z.object({action:z.literal("complete"),sessionId:uuid,callerLearnerId:uuid}).strict(),
]);
const invalid=(traceId:string)=>NextResponse.json({success:false,error:{code:"VALIDATION_ERROR",message:"Requête OSCE invalide."}},{status:400,headers:{"x-trace-id":traceId}});
const respond=async(traceId:string,op:()=>Promise<unknown>,status=200)=>{try{return NextResponse.json(apiSuccess(await op()),{status,headers:{"x-trace-id":traceId,"cache-control":"no-store"}});}catch(error){const x=mapErrorToHttp(error);return NextResponse.json(x.body,{status:x.status,headers:{"x-trace-id":traceId,"cache-control":"no-store"}});}};
export function createOsceHandlers(load:()=>Promise<OsceApi>){return{GET:async(request:Request)=>{const traceId=resolveTraceId(request.headers.get("x-trace-id"));const url=new URL(request.url);const id=uuid.safeParse(url.searchParams.get("id"));if(!id.success)return invalid(traceId);const view=url.searchParams.get("view")??"state";const api=await load();if(view==="station")return respond(traceId,()=>api.getStation(id.data));const caller=uuid.safeParse(url.searchParams.get("learnerId"));if(!caller.success)return invalid(traceId);if(view==="replay")return respond(traceId,()=>api.replay(id.data,caller.data));return respond(traceId,()=>api.state(id.data,caller.data));},POST:async(request:Request)=>{const traceId=resolveTraceId(request.headers.get("x-trace-id"));let raw:unknown;try{raw=await request.json();}catch{return invalid(traceId);}const parsed=body.safeParse(raw);if(!parsed.success)return invalid(traceId);const api=await load();const x=parsed.data;if(x.action==="start")return respond(traceId,()=>api.start({...x,traceId}),201);if(x.action==="interact")return respond(traceId,()=>api.interact({...x,traceId}),201);if(x.action==="reveal")return respond(traceId,()=>api.reveal({...x,traceId}),201);return respond(traceId,()=>api.complete({...x,traceId}),201);}};}
const handlers=createOsceHandlers(async()=>(await import("@/infrastructure/osce/server-osce")).osceApi);export const GET=handlers.GET;export const POST=handlers.POST;
