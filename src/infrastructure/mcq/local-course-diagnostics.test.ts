import { expect, it, vi } from "vitest";
import { LocalCourseDiagnostics, type Stage } from "../../../scripts/local-course-diagnostics";
import { AppError } from "@/shared/errors/app-error";
import { OpenAiCourseGenerator } from "./openai-course-generator";
import { runLocalCourseTraining } from "../../../scripts/test-local-course-training";
import { PDF_NAME } from "../../../scripts/test-openai-course-isolated";
import { SqliteCourseTraining } from "./sqlite-course-training";
import { generatedCourseItems } from "@/application/mcq/course-generation";

vi.mock("../../../scripts/test-openai-course-isolated", async original => ({
  ...await original<typeof import("../../../scripts/test-openai-course-isolated")>(),
  extract: async () => ({ text: "Le pharmacien recueille les données pertinentes avant de proposer un plan de soins.", pages: 20, pageTexts: [{ pageNumber: 1, text: "Le pharmacien recueille les données pertinentes avant de proposer un plan de soins." }] }),
}));

const sensitive = "SENSITIVE_KEY_BODY_PDF_QUESTION";
it.each<Stage>(["ARGUMENTS", "COST_PREFLIGHT", "PDF_READ", "PDF_CHECKSUM", "PDF_EXTRACTION", "SQLITE_FIXTURE", "SOURCE_RESOLUTION", "PAYLOAD_GUARD", "PRE_PROVIDER", "CORPUS_VALIDATION", "PERSISTENCE", "REVIEW_READ"])("reports only fixed safe fields for %s", stage => {
  const d = new LocalCourseDiagnostics(); d.stage = stage;
  expect(d.failure(new Error(sensitive))).toEqual({ FAILED_STAGE: stage, ERROR_CODE: `${stage}_FAILED`, PROVIDER_ATTEMPTED: false, FAILED_RULES: [] });
});
it.each([401, 403, 404, 429, 500])("reports HTTP %s without reading the error body", async status => {
  const d = new LocalCourseDiagnostics();
  const response = new Response(sensitive, { status });
  const json = vi.spyOn(response, "json");
  await d.transport(vi.fn<typeof fetch>().mockResolvedValue(response))("offline");
  expect(d.failure(new Error(sensitive))).toMatchObject({ FAILED_STAGE: "PROVIDER_RESPONSE", ERROR_CODE: `HTTP_${status}`, PROVIDER_ATTEMPTED: true });
  expect(json).not.toHaveBeenCalled();
});
it.each(["network", "envelope", "candidate-json", "schema", "grounding", "duplicate"])("classifies %s through the real provider with mock transport", async mode => {
  const d = new LocalCourseDiagnostics();
  const quote = "Le pharmacien recueille les données pertinentes avant de proposer un plan de soins.";
  const candidate = { stem: "Question", options: ["Un", "Deux", "Trois", "Quatre"], correct: "a", explanation: quote, simple: quote, analogy: quote, mechanism: quote, reasoning: quote, clue: quote, justifications: [quote, quote, quote, quote], trap: quote, takeaway: quote, transfer: quote, quote: mode === "grounding" ? sensitive : quote, competency: "1.1" };
  const body = mode === "candidate-json" ? sensitive : JSON.stringify({ questions: mode === "schema" ? [] : [candidate, { ...candidate, stem: mode === "duplicate" ? "Question" : "Autre question" }] });
  const request = vi.fn<typeof fetch>(async () => {
    if (mode === "network") throw new Error(sensitive);
    return new Response(mode === "envelope" ? sensitive : JSON.stringify({ status: "completed", output: [{ content: [{ type: "output_text", text: body }] }] }));
  });
  const provider = new OpenAiCourseGenerator({ load: () => ({ apiKey: sensitive, dailyBudgetCad: 1 }) }, () => "gpt-5.6-terra", d.transport(request), { budgetCad: () => 1, now: () => Date.parse("2026-09-29T12:00:00Z") });
  let report;
  try { await provider.generate({ documentId: 1, name: "Offline", text: quote, pages: [{ pageNumber: 1, text: quote }], sourceVersionId: "00000000-0000-4000-8000-000000000001" }, 2); }
  catch (error) { report = d.failure(error); }
  expect(report?.FAILED_STAGE).toBe(mode === "network" ? "PROVIDER_REQUEST" : ["envelope", "candidate-json"].includes(mode) ? "RESPONSE_PARSE" : "CANDIDATE_VALIDATION");
  if (mode === "grounding") expect(report?.FAILED_RULES).toContain("QUOTE_IN_SOURCE");
  if (mode === "duplicate") expect(report?.FAILED_RULES).toContain("UNIQUE_STEMS");
  expect(JSON.stringify(report)).not.toContain(sensitive);
  expect(request).toHaveBeenCalledTimes(1);
});
it("does not relay arbitrary error fields or untrusted rule names", () => {
  const d = new LocalCourseDiagnostics();
  const report = d.failure(new AppError({ code: sensitive, userMessage: sensitive, context: { stage: "CANDIDATE_VALIDATION", rules: { [sensitive]: false, FIELD_OPTIONS: false } } }));
  expect(report.FAILED_RULES).toEqual(["FIELD_OPTIONS"]);
  expect(JSON.stringify(report)).not.toContain(sensitive);
});
it.each(["CORPUS_VALIDATION", "PERSISTENCE"])("reports %s in the isolated use case", async stage => {
  const d = new LocalCourseDiagnostics();
  const generate = vi.spyOn(OpenAiCourseGenerator.prototype, "generate").mockImplementation(async source => {
    const quote = source.text;
    const items = generatedCourseItems({ questions: [1, 2].map(n => ({ stem: `Question ${n}`, options: ["Un", "Deux", "Trois", "Quatre"], correct: "a", explanation: quote, simple: quote, analogy: quote, mechanism: quote, reasoning: quote, clue: quote, justifications: [quote, quote, quote, quote], trap: quote, takeaway: quote, transfer: quote, quote, competency: "1.1" })) }, source);
    if (stage === "CORPUS_VALIDATION") items[0].choices = [];
    return items;
  });
  const save = stage === "PERSISTENCE" ? vi.spyOn(SqliteCourseTraining.prototype, "save").mockImplementation(() => { throw new Error(sensitive); }) : undefined;
  try {
    await expect(runLocalCourseTraining({ pdf: `scripts/fixtures/openai-isolated/${PDF_NAME}`, model: "gpt-5.6-terra", budget: "1", authorize: true, now: () => Date.parse("2026-09-29T12:00:00Z"), key: () => { throw new Error("Key must not be read"); }, request: vi.fn(), diagnostics: d })).rejects.toThrow();
    expect(d.failure(new Error(sensitive)).FAILED_STAGE).toBe(stage);
    expect(d.attempted).toBe(false);
  } finally { generate.mockRestore(); save?.mockRestore(); }
});
