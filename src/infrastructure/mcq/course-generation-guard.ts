import { z } from "zod";
import { courseGenerationInstructions, generatedCourseSchema } from "@/application/mcq/course-generation";
import type { CourseSource } from "@/application/mcq/course-training-contract";
import { MAX_COURSE_DRAFTS } from "@/application/mcq/course-training-contract";
import { AppError } from "@/shared/errors/app-error";

/** Per-request ceiling, NOT a cumulative daily spend ledger. Rates inherited
 * from the isolated policy reviewed 2026-09-28; never refreshed automatically.
 * Standard $2/$12 per million, conservative input x2 x1.25, output x1.5.
 * Cached-input discounts are deliberately not assumed.
 */
export const COURSE_COST_POLICY = Object.freeze({
  model: "gpt-5.6-terra", reviewedAt: "2026-09-28T00:00:00Z", expiresAt: "2026-10-06T00:00:00Z",
  maxInputTokens: 30_000, framingTokenReserve: 8192, maxOutputTokens: 6000,
  inputUsdPerMillion: 5, outputUsdPerMillion: 18, usdCadRate: 2, safetyMultiplier: 1.25,
  maximumCad: 0.65,
});

function refuse(rule: string): never {
  throw new AppError({ code: "COURSE_GENERATION_BLOCKED", category: "validation",
    userMessage: "La génération dépasse les limites autorisées ou sa politique de coût n’est pas valide.",
    context: { stage: "GENERATION_PREFLIGHT", rule } });
}

export function assertCourseCount(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COURSE_DRAFTS) refuse("DRAFT_COUNT");
}

export function assertCourseCost(model: string | undefined, budgetCad: number, now: number,
  policy: typeof COURSE_COST_POLICY = COURSE_COST_POLICY) {
  if (model !== policy.model || !Number.isFinite(now) || now < Date.parse(policy.reviewedAt) || now >= Date.parse(policy.expiresAt)) refuse("COST_POLICY");
  const numbers = [policy.maxInputTokens, policy.maxOutputTokens, policy.inputUsdPerMillion,
    policy.outputUsdPerMillion, policy.usdCadRate, policy.safetyMultiplier, policy.maximumCad, budgetCad];
  if (numbers.some(n => !Number.isFinite(n) || n <= 0)) refuse("COST_UNKNOWN");
  const maximumCad = Math.ceil((policy.maxInputTokens * policy.inputUsdPerMillion + policy.maxOutputTokens * policy.outputUsdPerMillion)
    / 1_000_000 * policy.usdCadRate * policy.safetyMultiplier * 100) / 100;
  if (maximumCad > 0.65 || maximumCad > policy.maximumCad || maximumCad > budgetCad) refuse("COST_LIMIT");
  return maximumCad;
}

/** The complete serialized request is counted, including JSON escaping/schema.
 * Byte-BPE upper bound: UTF-8 bytes + 8192 framing tokens; no character ratio,
 * tokenizer request, truncation or silent excerpt selection.
 */
export function measureCoursePayload(serialized: string) {
  const requestBytes = Buffer.byteLength(serialized, "utf8");
  const inputTokenUpperEstimate = requestBytes + COURSE_COST_POLICY.framingTokenReserve;
  return { requestBytes, inputTokenUpperEstimate, inputFits: inputTokenUpperEstimate < COURSE_COST_POLICY.maxInputTokens };
}

export function buildCoursePayload(source: CourseSource, count: number) {
  assertCourseCount(count);
  const schema = generatedCourseSchema.extend({ questions: generatedCourseSchema.shape.questions.length(count) });
  return JSON.stringify({ model: COURSE_COST_POLICY.model, store: false,
    max_output_tokens: COURSE_COST_POLICY.maxOutputTokens, service_tier: "default", truncation: "disabled",
    instructions: courseGenerationInstructions,
    input: JSON.stringify({ desiredQuestionCount: count, document: source.name, text: source.text }),
    text: { format: { type: "json_schema", name: "course_questions", strict: true, schema: z.toJSONSchema(schema) } },
  });
}

export function assertCoursePayload(serialized: string) {
  const measured = measureCoursePayload(serialized);
  if (!measured.inputFits) refuse("INPUT_LIMIT");
  return measured;
}


export type PreparedGeneration = Readonly<{ source: CourseSource; payload: string; pageStart: number; pageEnd: number }>;

/** Maximal whole-page prefix. The measured string is also the transport body. */
export function prepareCourseGeneration(source: CourseSource, count: number): PreparedGeneration {
  assertCourseCount(count);
  if (!source.pages?.length) refuse("PAGES_MISSING");
  if (source.pages.some((p, i) => p.pageNumber !== i + 1 || typeof p.text !== "string")) refuse("PAGES_INVALID");
  let prepared: PreparedGeneration | undefined;
  for (let end = 1; end <= source.pages.length; end++) {
    const pages = Object.freeze(source.pages.slice(0, end).map(p => Object.freeze({ ...p })));
    const selected = Object.freeze({ ...source, pages, text: pages.map(p => p.text).join("\n\n"), pageStart: 1, pageEnd: end });
    const payload = buildCoursePayload(selected, count);
    if (!measureCoursePayload(payload).inputFits) break;
    prepared = Object.freeze({ source: selected, payload, pageStart: 1, pageEnd: end });
  }
  if (!prepared) refuse("FIRST_PAGE_TOO_LARGE");
  if (!prepared.source.text.trim()) refuse("PAGES_EMPTY");
  return prepared;
}
