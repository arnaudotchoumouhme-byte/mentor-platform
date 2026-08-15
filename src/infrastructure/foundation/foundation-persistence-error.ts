import { AppError } from "@/shared/errors/app-error";

export class FoundationPersistenceError extends AppError {
  constructor(message: string, cause?: unknown, context: Readonly<Record<string, unknown>> = {}) {
    super({
      code: "FOUNDATION_PERSISTENCE_ERROR",
      userMessage: "Les données Foundation ne peuvent pas être enregistrées.",
      internalMessage: message,
      category: "database",
      cause,
      context,
    });
    this.name = "FoundationPersistenceError";
  }
}
