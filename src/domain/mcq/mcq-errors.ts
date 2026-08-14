import { AppError } from "@/shared/errors/app-error";

export type McqErrorCode =
  | "MCQ_ITEM_INVALID"
  | "MCQ_ITEM_VERSION_MISSING"
  | "MCQ_SELECTION_IMPOSSIBLE"
  | "MCQ_SESSION_NOT_FOUND"
  | "MCQ_SESSION_ALREADY_COMPLETED"
  | "MCQ_ITEM_NOT_IN_SESSION"
  | "MCQ_ANSWER_INVALID"
  | "MCQ_ANSWER_DUPLICATE";

export class McqError extends AppError {
  constructor(code: McqErrorCode, userMessage: string, internalMessage: string, context: Readonly<Record<string, unknown>> = {}) {
    super({ code, userMessage, internalMessage, category: "validation", context });
    this.name = "McqError";
  }
}
