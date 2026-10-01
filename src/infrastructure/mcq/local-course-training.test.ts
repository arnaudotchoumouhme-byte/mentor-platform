import { expect, it, vi } from "vitest";
import { runLocalCourseTraining } from "../../../scripts/test-local-course-training";
import { PDF_NAME } from "../../../scripts/test-openai-course-isolated";
import { COURSE_COST_POLICY } from "./course-generation-guard";
import { ISOLATED_COST_POLICY } from "../../../scripts/isolated-openai-cost-policy";

// Keep real file/checksum verification; extraction itself has separate PDF tests.
vi.mock("../../../scripts/test-openai-course-isolated", async original => ({
  ...await original<typeof import("../../../scripts/test-openai-course-isolated")>(),
  extract: async () => ({ text: "Le pharmacien recueille les données pertinentes avant de proposer un plan de soins.", pages: 20, pageTexts: [{ pageNumber: 1, text: "Le pharmacien recueille les données pertinentes avant de proposer un plan de soins." }] }),
}));

const base = { pdf: `scripts/fixtures/openai-isolated/${PDF_NAME}`, model: COURSE_COST_POLICY.model, budget: "1", now: () => Date.parse("2026-09-29T12:00:00Z") };
it("shares the exact application pricing object", () => expect(ISOLATED_COST_POLICY).toBe(COURSE_COST_POLICY));
it("prepares the real PDF fixture and memory DB without reading a key or calling transport", async () => {
  const key = vi.fn(); const request = vi.fn<typeof fetch>();
  const result = await runLocalCourseTraining({ ...base, authorize: false, key, request });
  expect(result).toMatchObject({ status: "PREPARED_ONLY", database: ":memory:", pdfChecksumMatch: true, ownership: true, sourceReady: true, calls: 0, draftsPersisted: 0, published: 0, inputFits: true });
  expect(key).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
});
it("uses the actual provider with one mock response, persists two drafts and reads them for review", async () => {
  const key = vi.fn(() => "offline-placeholder");
  const request = vi.fn<typeof fetch>(async (_url, init) => {
    const body = JSON.parse(init!.body as string);
    const source = JSON.parse(body.input);
    expect(source.desiredQuestionCount).toBe(2);
    expect(body.max_output_tokens).toBe(6000);
    const quote = source.text.slice(0, 120);
    const questions = [1, 2].map(n => ({ stem: `Question synthétique ${n}`, options: ["Un", "Deux", "Trois", "Quatre"], correct: "a", explanation: quote, simple: quote, analogy: "NOT_SUPPORTED_BY_SOURCE", mechanism: quote, reasoning: quote, clue: quote, justifications: [quote, quote, quote, quote], trap: quote, takeaway: quote, transfer: quote, quote, competency: "1.1" }));
    return new Response(JSON.stringify({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ questions }) }] }] }));
  });
  const review = vi.fn(state => {
    expect(state.questions).toHaveLength(2);
    expect(state.questions.every((q: { status: string }) => q.status === "DRAFT")).toBe(true);
  });
  const result = await runLocalCourseTraining({ ...base, authorize: true, key, request, review });
  expect(result).toMatchObject({ status: "PASS", calls: 1, draftsPersisted: 2, published: 0, filesWritten: 0 });
  expect(request).toHaveBeenCalledTimes(1); expect(review).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(result)).not.toContain("offline-placeholder");
});
it("blocks expired cost before key and never retries a failed provider", async () => {
  const key = vi.fn(() => "offline-placeholder"); const request = vi.fn<typeof fetch>().mockRejectedValue(new Error("mock failure"));
  await expect(runLocalCourseTraining({ ...base, now: () => Date.parse(COURSE_COST_POLICY.expiresAt), authorize: true, key, request })).rejects.toThrow();
  expect(key).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
  await expect(runLocalCourseTraining({ ...base, authorize: true, key, request })).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
});
