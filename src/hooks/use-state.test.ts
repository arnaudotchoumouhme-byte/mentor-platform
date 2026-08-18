// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppState, type AppState } from "./use-state";

const empty:AppState={subjects:[],documents:[],flashcards:[],questions:[],attempts:[],weaknesses:[],tasks:[],messages:[],settings:{}};
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
async function statusFor(response:Response){vi.stubGlobal("fetch",vi.fn(async()=>response));const hook=renderHook(()=>useAppState());await waitFor(()=>expect(hook.result.current.status).not.toBe("loading"));return hook;}
describe("useAppState",()=>{
  it.each([[401,"unauthenticated"],[403,"access-denied"],[409,"conflict"],[429,"quota-exceeded"],[500,"server-error"]] as const)("maps HTTP %s to %s without an endless loader",async(code,status)=>{const hook=await statusFor(Response.json({error:{code:`HTTP_${code}`,message:"failure",traceId:"trace_test_12345",retriable:code>=500}},{status:code,headers:{"x-trace-id":"trace_test_12345"}}));expect(hook.result.current.status).toBe(status);expect(hook.result.current.data).toBeNull();expect(hook.result.current.diagnostic.traceId).toBe("trace_test_12345");});
  it("distinguishes an empty loaded dashboard",async()=>{const hook=await statusFor(Response.json(empty));expect(hook.result.current.status).toBe("loaded-empty");expect(hook.result.current.data).toEqual(empty);});
  it("distinguishes loaded data and server errors",async()=>{const loaded={...empty,subjects:[{id:1,name:"Test",mastery:0,color:"#000"}]};expect((await statusFor(Response.json(loaded))).result.current.status).toBe("loaded");const failed=await statusFor(new Response(null,{status:500}));expect(failed.result.current.status).toBe("server-error");await act(async()=>failed.result.current.refresh());expect(failed.result.current.status).toBe("server-error");});
  it("turns a suspended request into an explicit timeout instead of loading forever",async()=>{vi.useFakeTimers();vi.stubGlobal("fetch",vi.fn((_input:unknown,init?:RequestInit)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener("abort",()=>reject(new DOMException("aborted","AbortError"))))));const hook=renderHook(()=>useAppState());await act(async()=>{await vi.advanceTimersByTimeAsync(10_001);});expect(hook.result.current.status).toBe("network-error");expect(hook.result.current.diagnostic.code).toBe("NET_REQUEST_TIMEOUT");});
});
