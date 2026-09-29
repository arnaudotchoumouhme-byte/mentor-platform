import type { AiConfigurationPort } from "@/application/config/ai-configuration";
import type { CourseQuestionGenerator, CourseSource } from "@/application/mcq/course-training-contract";
import { diagnoseGenerated, generatedCourseItems } from "@/application/mcq/course-generation";
import { AppError } from "@/shared/errors/app-error";
import { assertCourseCost, assertCourseCount, assertCoursePayload, buildCoursePayload } from "./course-generation-guard";

type GenerationControls = {
  budgetCad: () => number;
  now?: () => number;
  createTransport?: () => typeof fetch;
};

export class OpenAiCourseGenerator implements CourseQuestionGenerator {
  constructor(private readonly config: AiConfigurationPort, private readonly model: () => string | undefined,
    private readonly request?: typeof fetch,
    private readonly controls: GenerationControls = { budgetCad: () => NaN }) {}
  async generate(source: CourseSource, count: number) {
    assertCourseCount(count);
    const model = this.model();
    const now = this.controls.now ?? Date.now;
    assertCourseCost(model, this.controls.budgetCad(), now());
    const body = buildCoursePayload(source, count);
    assertCoursePayload(body);
    // Recheck expiry/budget after payload construction, still before any secret read.
    assertCourseCost(model, this.controls.budgetCad(), now());
    try {
      const { apiKey } = this.config.load();
      if (!apiKey) throw new AppError({ code: "COURSE_AI_UNAVAILABLE", userMessage: "La génération OpenAI n’est pas configurée sur le serveur.", category: "configuration" });
      const request = this.controls.createTransport?.() ?? this.request ?? fetch;
      const response = await request("https://api.openai.com/v1/responses", {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(120_000), redirect: "error", body,
      });
      if (!response.ok) throw new Error("provider-error");
      const data = await response.json() as { status?: string; output?: { content?: { type: string; text?: string }[] }[] };
      if (data.status !== "completed") throw new Error("incomplete-output");
      const text = data.output?.flatMap(o => o.content ?? []).filter(c => c.type === "output_text").map(c => c.text ?? "").join("");
      if (!text) throw new Error("empty-output");
      let raw: unknown;
      try { raw = JSON.parse(text); }
      catch {
        throw new AppError({ code: "COURSE_AI_UNAVAILABLE", userMessage: "La génération n’a pas abouti. Aucun brouillon enregistré.", category: "external", context: { stage: "CANDIDATE_VALIDATION", rules: { GENERATED_JSON: false } } });
      }
      try {
        const items = generatedCourseItems(raw, source);
        if (items.length !== count) throw new AppError({ code: "VALIDATION_ERROR", category: "validation", userMessage: "Le nombre de questions générées est invalide." });
        return items;
      }
      catch (error) {
        if (!(error instanceof AppError)) throw error;
        // Only fixed rule names and booleans; never carry the provider exception.
        throw new AppError({ code: error.code, userMessage: error.userMessage, category: error.category,
          context: { stage: "CANDIDATE_VALIDATION", rules: { GENERATED_JSON: true, ...diagnoseGenerated(raw, source), GENERATED_COUNT: typeof raw === "object" && raw !== null && "questions" in raw && Array.isArray(raw.questions) && raw.questions.length === count } } });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      // Never include provider body, key, source text or raw exception in the API/logs.
      throw new AppError({ code: "COURSE_AI_UNAVAILABLE", userMessage: "La génération n’a pas abouti. Aucun brouillon enregistré.", category: "external", retriable: false });
    }
  }
}
