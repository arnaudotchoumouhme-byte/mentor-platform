import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { COURSE_COST_POLICY as policy, assertCourseCost, assertCoursePayload, buildCoursePayload, measureCoursePayload, prepareCourseGeneration } from "./course-generation-guard";
import { OpenAiCourseGenerator } from "./openai-course-generator";
import { courseCommandSchema, type CourseTrainingRepository, type ProviderGate } from "@/application/mcq/course-training-contract";
import { CourseTraining } from "@/application/mcq/course-training";

const now = Date.parse("2026-09-29T12:00:00Z");
const quote = "Synthetic source reserved for offline course generation tests.";
const source = { documentId: 1, name: "Synthetic", text: quote, pages: [{ pageNumber: 1, text: quote }], sourceVersionId: "00000000-0000-4000-8000-000000000001" };
const candidate = (n: number) => ({ stem: `Synthetic question ${n}`, options: ["a", "b", "c", "d"], correct: "a", explanation: quote, simple: quote, analogy: quote, mechanism: quote, reasoning: quote, clue: quote, justifications: [quote, quote, quote, quote], trap: quote, takeaway: quote, transfer: quote, quote, competency: "1.1" });
function fixture(options: { budget?: number; model?: string; time?: number; responseCount?: number } = {}) {
  const events: string[] = [];
  const config = { load: vi.fn(() => { events.push("key"); return { apiKey: "synthetic-secret", dailyBudgetCad: 1 }; }) };
  const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ questions: Array.from({ length: options.responseCount ?? 2 }, (_, n) => candidate(n)) }) }] }] })));
  const factory = vi.fn(() => { events.push("provider"); return request; });
  const budgetCad = vi.fn(() => { events.push("budget"); return options.budget ?? 1; });
  const generator = new OpenAiCourseGenerator(config, () => options.model ?? policy.model, undefined,
    { budgetCad, now: () => options.time ?? now, createTransport: factory });
  return { generator, config, request, factory, events };
}

describe("controlled course generation — mocks only, no database", () => {
  it("wires the server generator to the policy model without requiring OPENAI_MCQ_MODEL", async () => {
    const serverSource = readFileSync(new URL("./server-course-training.ts", import.meta.url), "utf8");
    expect(serverSource).toContain("() => COURSE_COST_POLICY.model");
    expect(serverSource).not.toContain("OPENAI_MCQ_MODEL");
    const previous = process.env.OPENAI_MCQ_MODEL;
    delete process.env.OPENAI_MCQ_MODEL;
    try {
      const f = fixture({ model: policy.model });
      await expect(f.generator.generate(source, 2)).resolves.toHaveLength(2);
      expect(JSON.parse(f.request.mock.calls[0][1]?.body as string).model).toBe(policy.model);
      expect(f.request).toHaveBeenCalledTimes(1);
    } finally {
      if (previous === undefined) delete process.env.OPENAI_MCQ_MODEL;
      else process.env.OPENAI_MCQ_MODEL = previous;
    }
  });
  it("requests exactly two drafts, measures the actual payload and creates transport only after guards", async () => {
    const f = fixture();
    const items = await f.generator.generate(source, 2);
    expect(items).toHaveLength(2);
    expect(items.every(i => i.status === "DRAFT")).toBe(true);
    expect(f.events).toEqual(["budget", "key", "provider"]);
    expect(f.request).toHaveBeenCalledTimes(1);
    const [url, init] = f.request.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init?.redirect).toBe("error");
    expect(init?.body).toBe(buildCoursePayload(source, 2));
    expect(measureCoursePayload(init?.body as string).inputFits).toBe(true);
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({ model: policy.model, max_output_tokens: 6000, store: false, service_tier: "default", truncation: "disabled" });
    expect(body.text.format.schema.properties.questions).toMatchObject({ minItems: 2, maxItems: 2 });
    expect(JSON.parse(body.input)).toMatchObject({ desiredQuestionCount: 2, text: quote });
    expect(init?.body).not.toContain("synthetic-secret");
  });

  it.each([3, 10, 0, -1, 1.5, NaN, Infinity])("blocks count %s before secret/provider", async count => {
    const f = fixture();
    await expect(f.generator.generate(source, count)).rejects.toMatchObject({ context: { rule: "DRAFT_COUNT" } });
    expect(f.config.load).not.toHaveBeenCalled(); expect(f.factory).not.toHaveBeenCalled(); expect(f.request).not.toHaveBeenCalled();
  });

  it("enforces API defaults and rejects excess count before repository access", async () => {
    expect(courseCommandSchema.parse({ action: "generate" })).toEqual({ action: "generate", desiredQuestionCount: 2 });
    expect(courseCommandSchema.safeParse({ action: "generate", desiredQuestionCount: 3 }).success).toBe(false);
    const repository = { resolve: vi.fn(), list: vi.fn(), save: vi.fn() } as CourseTrainingRepository;
    const generator = { generate: vi.fn() };
    await expect(new CourseTraining(repository, generator, () => "unused").execute(1, "offline", { action: "generate", desiredQuestionCount: 3 })).rejects.toThrow();
    expect(repository.resolve).not.toHaveBeenCalled(); expect(repository.save).not.toHaveBeenCalled(); expect(generator.generate).not.toHaveBeenCalled();
  });

  it("blocks the complete oversized payload before reading a key or constructing transport", async () => {
    const f = fixture();
    await expect(f.generator.generate({ ...source, pages: [{ pageNumber: 1, text: "é\\\"".repeat(10000) }] }, 2)).rejects.toMatchObject({ context: { rule: "FIRST_PAGE_TOO_LARGE" } });
    expect(f.config.load).not.toHaveBeenCalled(); expect(f.factory).not.toHaveBeenCalled(); expect(f.request).not.toHaveBeenCalled();
  });

  it("measures UTF8 bytes plus reserve and refuses equality at the strict input ceiling", () => {
    expect(measureCoursePayload("é").inputTokenUpperEstimate).toBe(8194);
    expect(assertCoursePayload("x".repeat(21807)).inputFits).toBe(true);
    expect(() => assertCoursePayload("x".repeat(21808))).toThrow();
  });

  it.each([0, -1, NaN, Infinity, 0.64])("refuses budget %s before key/provider", async budget => {
    const f = fixture({ budget });
    await expect(f.generator.generate(source, 2)).rejects.toThrow();
    expect(f.config.load).not.toHaveBeenCalled(); expect(f.factory).not.toHaveBeenCalled(); expect(f.request).not.toHaveBeenCalled();
  });

  it.each([Date.parse(policy.expiresAt), NaN, Date.parse(policy.reviewedAt) - 1])("fails closed on invalid/expired time %s", async time => {
    const f = fixture({ time });
    await expect(f.generator.generate(source, 2)).rejects.toThrow();
    expect(f.config.load).not.toHaveBeenCalled(); expect(f.factory).not.toHaveBeenCalled();
  });

  it("refuses another model and absent safe budget reader", async () => {
    const f = fixture({ model: "other" });
    await expect(f.generator.generate(source, 2)).rejects.toThrow();
    await expect(new OpenAiCourseGenerator(f.config, () => policy.model, f.request).generate(source, 2)).rejects.toThrow();
    expect(f.config.load).not.toHaveBeenCalled(); expect(f.factory).not.toHaveBeenCalled(); expect(f.request).not.toHaveBeenCalled();
  });

  it("keeps the conservative ceiling at 0.65 CAD and rejects higher/unknown estimates", () => {
    expect(assertCourseCost(policy.model, 1, now)).toBe(0.65);
    expect(assertCourseCost(policy.model, 0.65, now)).toBe(0.65);
    expect(() => assertCourseCost(policy.model, 100, now, { ...policy, outputUsdPerMillion: 100 } as unknown as typeof policy)).toThrow();
    expect(() => assertCourseCost(policy.model, 1, now, { ...policy, inputUsdPerMillion: NaN } as typeof policy)).toThrow();
  });

  it.each([429, 500, 302])("never retries provider status %s or exposes its body", async status => {
    const f = fixture();
    f.request.mockImplementation(async () => new Response("PRIVATE_PROVIDER_BODY", { status }));
    const error = await f.generator.generate(source, 2).catch(e => e);
    expect(error.retriable).toBe(false);
    expect(JSON.stringify(error)).not.toMatch(/PRIVATE_PROVIDER_BODY|synthetic-secret/);
    expect(f.request).toHaveBeenCalledTimes(1);
  });

  it("never retries a thrown transport exception or exposes its contents", async () => {
    const f = fixture();
    f.request.mockRejectedValue(new Error("PRIVATE_PROVIDER_BODY synthetic-secret"));
    const error = await f.generator.generate(source, 2).catch(e => e);
    expect(JSON.stringify(error)).not.toMatch(/PRIVATE_PROVIDER_BODY|synthetic-secret/);
    expect(f.request).toHaveBeenCalledTimes(1);
  });

  it.each([1, 3])("rejects unexpected response count %s without a second call", async responseCount => {
    const f = fixture({ responseCount });
    await expect(f.generator.generate(source, 2)).rejects.toMatchObject({ context: { rules: { GENERATED_COUNT: false } } });
    expect(f.request).toHaveBeenCalledTimes(1);
  });
});


describe("page preflight before metering", () => {
  it("selects the maximal contiguous whole-page prefix and preserves exact transport bytes", async () => {
    const f = fixture();
    const pages = Array.from({length: 10}, (_, i) => ({pageNumber: i + 1, text: quote + "x".repeat(4000)}));
    const prepared = prepareCourseGeneration({...source, pages}, 2);
    expect(prepared.pageStart).toBe(1); expect(prepared.pageEnd).toBeGreaterThan(0); expect(prepared.pageEnd).toBeLessThan(10);
    expect(prepared.source.pages).toEqual(pages.slice(0, prepared.pageEnd));
    expect(prepared.source.text).toBe(pages.slice(0, prepared.pageEnd).map(p=>p.text).join("\n\n"));
    expect(Object.isFrozen(prepared)).toBe(true); expect(Object.isFrozen(prepared.source.pages![0])).toBe(true);
    expect(measureCoursePayload(prepared.payload).inputFits).toBe(true);
    expect(measureCoursePayload(buildCoursePayload({...source, text: pages.slice(0, prepared.pageEnd+1).map(p=>p.text).join("\n\n")}, 2)).inputFits).toBe(false);
    const previousQuestions = [{ itemId: "prior-1", stem: "Concept déjà traité", pageStart: 1, pageEnd: prepared.pageEnd, status: "RETIRED" as const }];
    const next = prepareCourseGeneration({ ...source, pages, nextPageNumber: prepared.pageEnd + 1, previousQuestions }, 2);
    expect(next.pageStart).toBe(prepared.pageEnd + 1);
    expect(next.pageStart).toBeGreaterThan(prepared.pageEnd);
    expect(JSON.parse(JSON.parse(next.payload).input).previousQuestions).toEqual(previousQuestions);
    const quota = vi.fn<ProviderGate>(async operation => {f.events.push("quota"); return operation();});
    const items = await f.generator.generate({...source, pages}, 2, quota);
    expect(f.request.mock.calls[0][1]?.body).toBe(prepared.payload);
    expect(items[0].source.reference).toMatchObject({type:"PAGE", locator:`pages 1–${prepared.pageEnd}`});
    expect(f.events).toEqual(["budget","quota","key","provider"]);
    expect(quota).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["missing", undefined], ["oversize", [{pageNumber:1,text:"x".repeat(30000)}]],
    ["gap", [{pageNumber:1,text:quote},{pageNumber:3,text:quote}]],
    ["duplicate", [{pageNumber:1,text:quote},{pageNumber:1,text:quote}]],
  ])("refuses %s pages without quota, secret or provider", async (_name, pages) => {
    const f=fixture(); const quota=vi.fn<ProviderGate>();
    await expect(f.generator.generate({...source,pages:pages as typeof source.pages | undefined},2,quota)).rejects.toThrow();
    expect(quota).not.toHaveBeenCalled(); expect(f.config.load).not.toHaveBeenCalled(); expect(f.request).not.toHaveBeenCalled();
  });
  it.each([{model:"other"},{budget:0},{time:Date.parse(policy.expiresAt)}])("refuses policy before quota %j", async options=>{
    const f=fixture(options); const quota=vi.fn<ProviderGate>();
    await expect(f.generator.generate(source,2,quota)).rejects.toThrow();
    expect(quota).not.toHaveBeenCalled(); expect(f.config.load).not.toHaveBeenCalled(); expect(f.request).not.toHaveBeenCalled();
  });
  it("refuses exhausted quota before secret or transport", async()=>{
    const f=fixture();const quota=vi.fn<ProviderGate>(async()=>{throw new Error("quota");});
    await expect(f.generator.generate(source,2,quota)).rejects.toThrow("quota");
    expect(quota).toHaveBeenCalledTimes(1);expect(f.config.load).not.toHaveBeenCalled();expect(f.factory).not.toHaveBeenCalled();
  });
  it("persists exactly two drafts after one quota charge and one provider call", async()=>{
    const f=fixture();
    const quota=vi.fn<ProviderGate>(async operation=>operation());
    const save=vi.fn(async (corpus:{items:readonly {status:string}[]})=>{
      expect(corpus.items).toHaveLength(2);
      expect(corpus.items.every((item: {status:string})=>item.status==="DRAFT")).toBe(true);
    });
    const repository={resolve:()=>source,list:()=>[],save};
    await new CourseTraining(repository,f.generator,(()=>{let n=0;return()=>`draft-${++n}`;})())
      .execute(1,"owner",{action:"generate",desiredQuestionCount:2},quota);
    expect(quota).toHaveBeenCalledTimes(1);
    expect(f.request).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("keeps one quota charge and no drafts after provider failure, without retry",async()=>{
    const f=fixture();f.request.mockRejectedValue(new Error("offline failure"));
    const quota=vi.fn<ProviderGate>(async operation=>operation());
    const repository={resolve:()=>source,list:()=>[],save:vi.fn()};
    await expect(new CourseTraining(repository,f.generator,()=>"unused").execute(1,"owner",{action:"generate",desiredQuestionCount:2},quota)).rejects.toThrow();
    expect(quota).toHaveBeenCalledTimes(1);expect(f.request).toHaveBeenCalledTimes(1);expect(repository.save).not.toHaveBeenCalled();
  });
  it("locks before preflight so concurrent clicks meter and call only once",async()=>{
    const f=fixture();let release!:()=>void;const pending=new Promise<void>(r=>{release=r;});
    const quota=vi.fn<ProviderGate>(async operation=>{await pending;return operation();});
    const repository={resolve:()=>source,list:()=>[],save:vi.fn()};
    const service=new CourseTraining(repository,f.generator,(()=>{let n=0;return()=>`id-${++n}`;})());
    const first=service.execute(1,"owner",{action:"generate",desiredQuestionCount:2},quota);
    await expect(service.execute(1,"owner",{action:"generate",desiredQuestionCount:2},quota)).rejects.toMatchObject({code:"CONFLICT"});
    expect(f.events).toEqual(["budget"]);expect(quota).toHaveBeenCalledTimes(1);
    release();await first;expect(f.request).toHaveBeenCalledTimes(1);expect(repository.save).toHaveBeenCalledTimes(1);
  });
});
