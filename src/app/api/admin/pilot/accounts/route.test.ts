import { describe, expect, it } from "vitest";
import { AppError } from "@/shared/errors/app-error";
import { createProvisionAccountPost } from "./route";

const request=(body:unknown)=>new Request("http://x/api/admin/pilot/accounts",{method:"POST",headers:{"content-type":"application/json","x-trace-id":"trace_12345678"},body:JSON.stringify(body)});
describe("POST /api/admin/pilot/accounts",()=>{
  it("returns a created account without exposing its subject",async()=>{const post=createProvisionAccountPost(async()=>({account:{accountId:"a",oidcSubject:"auth0|secret",learnerId:"l",status:"ACTIVE",createdAt:"now",updatedAt:"now"},outcome:"CREATED"}));const response=await post(request({oidcSubject:"auth0|pilot"}));expect(response.status).toBe(201);expect(JSON.stringify(await response.json())).not.toContain("auth0|");});
  it("maps unauthenticated and forbidden operators",async()=>{for(const [code,status] of [["UNAUTHORIZED",401],["PILOT_ACCESS_DENIED",403]] as const){const post=createProvisionAccountPost(async()=>{throw new AppError({code,userMessage:"refused",category:"security"})});expect((await post(request({oidcSubject:"auth0|pilot"}))).status).toBe(status);}});
  it("rejects malformed input before provisioning",async()=>{const post=createProvisionAccountPost(async()=>{throw new Error("must not run")});expect((await post(request({oidcSubject:""}))).status).toBe(400);});
  it("rejects invalid JSON without exposing an internal error",async()=>{const post=createProvisionAccountPost(async()=>{throw new Error("must not run")});const response=await post(new Request("http://x/api/admin/pilot/accounts",{method:"POST",headers:{"content-type":"application/json"},body:"{"}));expect(response.status).toBe(400);});
});
