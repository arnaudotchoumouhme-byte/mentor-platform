import { AppError } from "@/shared/errors/app-error";

export type FoundationErrorCode =
  | "FOUNDATION_ID_INVALID"
  | "FOUNDATION_CURRICULUM_INVALID"
  | "FOUNDATION_CURRICULUM_PUBLISHED"
  | "FOUNDATION_PREREQUISITE_INVALID"
  | "FOUNDATION_DIAGNOSTIC_INVALID"
  | "FOUNDATION_DIAGNOSTIC_CLOSED"
  | "FOUNDATION_OBSERVATION_INVALID"
  | "FOUNDATION_MASTERY_INVALID"
  | "FOUNDATION_RECOMMENDATION_INVALID"
  | "FOUNDATION_EXIT_ASSESSMENT_INVALID"
  | "FOUNDATION_PROGRESS_INVALID_TRANSITION";

export class FoundationError extends AppError {
  constructor(
    code: FoundationErrorCode,
    internalMessage: string,
    context: Readonly<Record<string, unknown>> = {},
  ) {
    super({
      code,
      userMessage: "Les données Foundation sont invalides.",
      internalMessage,
      category: "validation",
      context,
    });
    this.name = "FoundationError";
  }
}
