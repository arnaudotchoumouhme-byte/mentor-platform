import { describe, expect, it, vi } from "vitest";
import { COURSE_COST_POLICY as policy, assertCourseCost, assertCoursePayload, buildCoursePayload, measureCoursePayload } from "./course-generation-guard";
import { OpenAiCourseGenerator } from "./openai-course-generator";
import { courseCommandSchema, type CourseTrainingRepository } from "@/application/mcq/course-training-contract";
import { CourseTraining } from "@/application/mcq/course-training";

const now = Date.parse("2026-09-29T12:00:00Z");
const quote = "Synthetic source reserved for offline course generation tests.";
const source = { documentId: 1, name: "Synthetic", text: quote, sourceVersionId: "00000000-0000-4000-8000-000000000001" };
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
  it("requests exactly two drafts, measures the actual payload and creates transport only after guards", async () => {
    const f = fixture();
    const items = await f.generator.generate(source, 2);
    expect(items).toHaveLength(2);
    expect(items.every(i => i.status === "DRAFT")).toBe(true);
    expect(f.events).toEqual(["budget", "budget", "key", "provider"]);
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
    await expect(f.generator.generate({ ...source, text: "é\\\"".repeat(10000) }, 2)).rejects.toMatchObject({ context: { rule: "INPUT_LIMIT" } });
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
