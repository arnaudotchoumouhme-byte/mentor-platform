import { z } from "zod";
import type { AiConfigurationPort } from "@/application/config/ai-configuration";
import type { CourseQuestionGenerator, CourseSource } from "@/application/mcq/course-training-contract";
import { courseGenerationInstructions, generatedCourseItems, generatedCourseSchema } from "@/application/mcq/course-generation";
import { AppError } from "@/shared/errors/app-error";

export class OpenAiCourseGenerator implements CourseQuestionGenerator {
  constructor(private readonly config: AiConfigurationPort, private readonly model: () => string | undefined, private readonly request: typeof fetch = fetch) {}
  async generate(source: CourseSource, count: number) {
    const { apiKey, dailyBudgetCad } = this.config.load();
    const model = this.model();
    if (!apiKey || !model || dailyBudgetCad <= 0) throw new AppError({ code: "COURSE_AI_UNAVAILABLE", userMessage: "La génération OpenAI n’est pas configurée sur le serveur.", category: "configuration" });
    if (source.text.length > 180_000) throw new AppError({ code: "VALIDATION_ERROR", userMessage: "Ce cours est trop long pour une préparation en une seule fois.", category: "validation" });
    try {
      const response = await this.request("https://api.openai.com/v1/responses", {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({ model, store: false, max_output_tokens: 24000,
          instructions: courseGenerationInstructions,
          input: JSON.stringify({ desiredQuestionCount: count, document: source.name, text: source.text }),
          text: { format: { type: "json_schema", name: "course_questions", strict: true, schema: z.toJSONSchema(generatedCourseSchema) } },
        }),
      });
      if (!response.ok) throw new Error("provider-error");
      const data = await response.json() as { status?: string; output?: { content?: { type: string; text?: string }[] }[] };
      if (data.status !== "completed") throw new Error("incomplete-output");
      const text = data.output?.flatMap(o => o.content ?? []).filter(c => c.type === "output_text").map(c => c.text ?? "").join("");
      if (!text) throw new Error("empty-output");
      return generatedCourseItems(JSON.parse(text), source);
    } catch (error) {
      if (error instanceof AppError) throw error;
      // Never include provider body, key, source text or raw exception in the API/logs.
      throw new AppError({ code: "COURSE_AI_UNAVAILABLE", userMessage: "La génération n’a pas abouti. Aucun brouillon enregistré.", category: "external", retriable: true });
    }
  }
}
