import { AppError } from "../src/shared/errors/app-error";

export type Stage = "ARGUMENTS" | "COST_PREFLIGHT" | "PDF_READ" | "PDF_CHECKSUM" | "PDF_EXTRACTION" | "SQLITE_FIXTURE" | "SOURCE_RESOLUTION" | "PAYLOAD_GUARD" | "PRE_PROVIDER" | "PROVIDER_REQUEST" | "PROVIDER_RESPONSE" | "RESPONSE_PARSE" | "CANDIDATE_VALIDATION" | "CORPUS_VALIDATION" | "PERSISTENCE" | "REVIEW_READ";
const rules = ["GENERATED_JSON", "GENERATED_SCHEMA", "GENERATED_ARRAY_BOUNDS", "GENERATED_COUNT", "QUOTE_IN_SOURCE", "UNIQUE_STEMS", "UNIQUE_OPTION_TEXTS", ...["STEM", "OPTIONS", "CORRECT", "EXPLANATION", "SIMPLE", "ANALOGY", "MECHANISM", "REASONING", "CLUE", "JUSTIFICATIONS", "TRAP", "TAKEAWAY", "TRANSFER", "QUOTE", "COMPETENCY"].map(f => `FIELD_${f}`)];
export class LocalCourseDiagnostics {
  stage: Stage = "ARGUMENTS";
  attempted = false;
  httpStatus: number | undefined;
  transport(request: typeof fetch): typeof fetch {
    return async (url, init) => {
      this.stage = "PROVIDER_REQUEST";
      this.attempted = true;
      const response = await request(url, init);
      this.stage = "PROVIDER_RESPONSE";
      this.httpStatus = response.status;
      // Preserve the real Response; only observe its existing single JSON read.
      const json = response.json.bind(response);
      response.json = async () => {
        this.stage = "RESPONSE_PARSE";
        const data = await json();
        this.stage = "PROVIDER_RESPONSE";
        return data;
      };
      return response;
    };
  }
  failure(error: unknown) {
    let stage = this.stage;
    const failedRules: string[] = [];
    if (error instanceof AppError && error.context.stage === "CANDIDATE_VALIDATION") {
      const values = error.context.rules;
      if (values && typeof values === "object") for (const rule of rules) {
        if ((values as Record<string, unknown>)[rule] === false) failedRules.push(rule);
      }
      stage = failedRules.includes("GENERATED_JSON") ? "RESPONSE_PARSE" : "CANDIDATE_VALIDATION";
    }
    if (error instanceof AppError && error.context.stage === "GENERATION_PREFLIGHT") stage = error.context.rule === "INPUT_LIMIT" ? "PAYLOAD_GUARD" : "COST_PREFLIGHT";
    const http = this.httpStatus;
    return { FAILED_STAGE: stage, ERROR_CODE: stage === "PROVIDER_RESPONSE" && http !== undefined && http >= 400 && http <= 599 ? `HTTP_${http}` : `${stage}_FAILED`, PROVIDER_ATTEMPTED: this.attempted, FAILED_RULES: failedRules };
  }
}
