import { describe, expect, it, vi } from "vitest";
import { OpenAiCourseGenerator } from "./openai-course-generator";
const source = { documentId: 1, name: "Synthétique", text: "Texte", pages: [{ pageNumber: 1, text: "Texte" }], sourceVersionId: "00000000-0000-4000-8000-000000000001" };
describe("OpenAI course generator", () => {
  it("fails closed without server configuration", async () => {
    const request = vi.fn();
    await expect(new OpenAiCourseGenerator({ load: () => ({ apiKey: undefined, dailyBudgetCad: 2 }) }, () => "gpt-5.6-terra", request, { budgetCad: () => 1, now: () => Date.parse("2026-09-29T12:00:00Z") }).generate(source, 1)).rejects.toMatchObject({ code: "COURSE_AI_UNAVAILABLE" });
    expect(request).not.toHaveBeenCalled();
  });
  it("uses structured output, no storage, no secrets in input and no automatic retry", async () => {
    const request = vi.fn(async () => new Response('{"error":"private provider detail"}', { status: 429 }));
    const generator = new OpenAiCourseGenerator({ load: () => ({ apiKey: "test-secret", dailyBudgetCad: 2 }) }, () => "gpt-5.6-terra", request, { budgetCad: () => 1, now: () => Date.parse("2026-09-29T12:00:00Z") });
    await expect(generator.generate(source, 1)).rejects.toMatchObject({ code: "COURSE_AI_UNAVAILABLE", userMessage: "La génération n’a pas abouti. Aucun brouillon enregistré." });
    expect(request).toHaveBeenCalledTimes(1);
    const body = JSON.parse((request.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.store).toBe(false); expect(body.text.format.strict).toBe(true);
    expect(body.input).not.toContain("test-secret");
  });
});
