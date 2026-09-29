import { expect, it, vi } from "vitest";
import { diagnoseGenerated, generatedCourseItems } from "@/application/mcq/course-generation";
import { OpenAiCourseGenerator } from "./openai-course-generator";

const quote = "Synthetic excerpt reserved for offline validation.";
const source = { documentId: 1, name: "offline", text: quote, sourceVersionId: "00000000-0000-4000-8000-000000000001" };
const item = () => ({ stem: "Synthetic question", options: ["a", "b", "c", "d"], correct: "a", explanation: quote, simple: quote, analogy: quote, mechanism: quote, reasoning: quote, clue: quote, justifications: [quote, quote, quote, quote], trap: quote, takeaway: quote, transfer: quote, quote, competency: "1.1" });

it.each([
  ["FIELD_REASONING", { reasoning: "" }], ["FIELD_TRANSFER", { transfer: "" }],
  ["FIELD_JUSTIFICATIONS", { justifications: [quote] }], ["FIELD_OPTIONS", { options: ["a"] }],
  ["FIELD_CORRECT", { correct: "e" }], ["FIELD_COMPETENCY", { competency: "invalid" }],
  ["QUOTE_IN_SOURCE", { quote: "A fabricated passage absent from the source document." }],
  ["UNIQUE_OPTION_TEXTS", { options: ["a", "a", "c", "d"] }],
  ["GENERATED_SCHEMA", { extra: "PRIVATE_SENTINEL" }],
] as const)("reports only safe diagnostics for %s", async (rule, patch) => {
  const raw = { questions: [{ ...item(), ...patch }] };
  expect(diagnoseGenerated(raw, source)[rule]).toBe(false);
  expect(() => generatedCourseItems(raw, source)).toThrow();
  const request = vi.fn(async () => new Response(JSON.stringify({ status: "completed", privateMetadata: "PRIVATE_SENTINEL", output: [{ content: [{ type: "output_text", text: JSON.stringify(raw) }] }] })));
  const generator = new OpenAiCourseGenerator({ load: () => ({ apiKey: "synthetic-secret", dailyBudgetCad: 2 }) }, () => "offline-model", request);
  const error = await generator.generate(source, 10).catch(e => e);
  expect(error.context).toMatchObject({ stage: "CANDIDATE_VALIDATION", rules: { [rule]: false } });
  const serialized = JSON.stringify(error);
  for (const sensitive of [quote, "Synthetic question", "PRIVATE_SENTINEL", "synthetic-secret", "privateMetadata"]) expect(serialized).not.toContain(sensitive);
  expect(Object.values(error.context.rules).every(v => typeof v === "boolean")).toBe(true);
  expect(error.cause).toBeUndefined();
  expect(request).toHaveBeenCalledTimes(1);
});

it("keeps invalid JSON private without retry", async () => {
  const request = vi.fn(async () => new Response(JSON.stringify({ status: "completed", output: [{ content: [{ type: "output_text", text: "PRIVATE_INVALID_JSON" }] }] })));
  const generator = new OpenAiCourseGenerator({ load: () => ({ apiKey: "synthetic-secret", dailyBudgetCad: 2 }) }, () => "offline-model", request);
  const error = await generator.generate(source, 10).catch(e => e);
  expect(error.context.rules).toEqual({ GENERATED_JSON: false });
  expect(JSON.stringify(error)).not.toContain("PRIVATE_INVALID_JSON");
  expect(request).toHaveBeenCalledTimes(1);
});

it("retains DRAFT, provenance and Mentor V2 review markers", () => {
  const marker = "HUMAN_REVIEW_REQUIRED: INSUFFICIENT_SOURCE";
  const [result] = generatedCourseItems({ questions: [{ ...item(), justifications: [quote, marker, marker, marker] }] }, source);
  expect(result.status).toBe("DRAFT");
  expect(result.version).toBe(1);
  expect(result.source.sourceVersionId).toBe(source.sourceVersionId);
  for (const section of ["Comme à un enfant", "Analogie", "Mécanisme", "Raisonnement du pharmacien", "Indice discriminant", "A — VRAI", "B — FAUX", "C — FAUX", "D — FAUX", "Piège classique", "Point PEBC", "Application clinique", "Source", marker]) expect(result.explanation).toContain(section);
});

it("diagnoses duplicate stems without relaxing validation", () => {
  const raw = { questions: [item(), item()] };
  expect(diagnoseGenerated(raw, source).UNIQUE_STEMS).toBe(false);
  expect(() => generatedCourseItems(raw, source)).toThrow();
});
