import {describe,expect,it,vi} from "vitest";import {AppError} from "@/shared/errors/app-error";
vi.mock("@/infrastructure/database/sqlite/server-sqlite-executor",()=>({sqliteExecutor:{all:vi.fn(()=>[]),run:vi.fn()}}));vi.mock("@/lib/db",()=>({all:vi.fn(()=>[])}));vi.mock("@/infrastructure/documents/server-document-import",()=>({importDocuments:{execute:vi.fn()}}));
import {createActionsPost} from "./actions/route";import {createAiPost} from "./ai/route";import {createCoachPost} from "./coach/route";import {createDocumentsPost} from "./documents/route";import {createDocumentGet} from "./documents/[id]/route";import {createSearchPost} from "./search/route";import {createStateGet} from "./state/route";
const active=async()=>({accountId:"account-a",learnerId:"learner-a"});const denied=async()=>{throw new AppError({code:"PILOT_ACCESS_DENIED",userMessage:"Accès refusé",category:"security"});};const json=(url:string,body:unknown)=>new Request(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const documentContext={params:Promise.resolve({id:"1"})};
describe("closed pilot sensitive API contract",()=>{
  it("fails closed on every sensitive API when Account is absent or disabled",async()=>{const responses=await Promise.all([
    createActionsPost({execute:vi.fn()},denied)(json("http://x/api/actions",{action:"deleteDocument",id:1})),
    createAiPost({execute:vi.fn()},denied,async(_i,_t,op)=>op())(json("http://x/api/ai",{question:"Question valide"})),
    createCoachPost(denied,async()=>({start:vi.fn(),answer:vi.fn(),resume:vi.fn()}),{bind:vi.fn(),assert:vi.fn()})(json("http://x/api/coach",{action:"resume",sessionId:"10000000-0000-4000-8000-000000000001"})),
    createDocumentsPost({execute:vi.fn()},denied)(new Request("http://x/api/documents",{method:"POST",body:new FormData()})),
    createDocumentGet(denied)(new Request("http://x/api/documents/1"),documentContext),
    createSearchPost(denied,vi.fn(()=>[]))(json("http://x/api/search",{query:"test"})),createStateGet(denied)(),
  ]);for(const response of responses)expect(response.status).toBe(403);});
  it("allows an ACTIVE account through each route boundary",async()=>{const form=new FormData();form.append("files",new File(["x"],"x.txt",{type:"text/plain"}));const responses=await Promise.all([
    createActionsPost({execute:vi.fn()},active)(json("http://x/api/actions",{action:"deleteDocument",id:1})),
    createAiPost({execute:vi.fn(async()=>({answer:"ok"}))} as never,active,async(_i,_t,op)=>op())(json("http://x/api/ai",{question:"Question valide"})),
    createCoachPost(active,async()=>({start:vi.fn(),answer:vi.fn(),resume:vi.fn(()=>({ok:true}))}),{bind:vi.fn(),assert:vi.fn()})(json("http://x/api/coach",{action:"resume",sessionId:"10000000-0000-4000-8000-000000000001"})),
    createDocumentsPost({execute:vi.fn(async()=>({imported:[],rejected:[],documents:[]}))},active)(new Request("http://x/api/documents",{method:"POST",body:form})),
    createDocumentGet(active)(new Request("http://x/api/documents/1"),documentContext),createSearchPost(active,vi.fn(()=>[]))(json("http://x/api/search",{query:"test"})),createStateGet(active)(),
  ]);expect(responses.map(x=>x.status)).toEqual([200,200,200,200,404,200,200]);});
  it("meters AI only after ACTIVE identity resolution",async()=>{const called=vi.fn();const meter=async<T>(identity:{accountId:string;learnerId:string},traceId:string,operation:()=>Promise<T>)=>{called(identity,traceId);return operation();};await createAiPost({execute:vi.fn(async()=>({answer:"ok"}))} as never,active,meter)(json("http://x/api/ai",{question:"Question valide"}));expect(called).toHaveBeenCalledWith(expect.objectContaining({accountId:"account-a"}),expect.any(String));});
});
