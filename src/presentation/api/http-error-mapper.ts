import { apiFailure, type ApiFailure } from "@/shared/api/contracts";
import { AppError } from "@/shared/errors/app-error";

const httpStatusByErrorCode: Readonly<Record<string, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  FILE_DUPLICATE: 409,
  INGEST_NO_TEXT_FOUND: 422,
  INGEST_REQUIRES_OCR: 422,
  INGEST_PDF_EXTRACTION_FAILED: 422,
  INGEST_DOCX_EXTRACTION_FAILED: 422,
  MCQ_ITEM_INVALID: 422,
  MCQ_ITEM_VERSION_MISSING: 404,
  MCQ_SELECTION_IMPOSSIBLE: 422,
  MCQ_SESSION_NOT_FOUND: 404,
  MCQ_SESSION_ALREADY_COMPLETED: 409,
  MCQ_ITEM_NOT_IN_SESSION: 409,
  MCQ_ANSWER_INVALID: 422,
  MCQ_ANSWER_DUPLICATE: 409,
  FOUNDATION_ID_INVALID: 400,
  FOUNDATION_CURRICULUM_INVALID: 422,
  FOUNDATION_CURRICULUM_PUBLISHED: 409,
  FOUNDATION_PREREQUISITE_INVALID: 422,
  FOUNDATION_DIAGNOSTIC_INVALID: 422,
  FOUNDATION_DIAGNOSTIC_CLOSED: 409,
  FOUNDATION_OBSERVATION_INVALID: 422,
  FOUNDATION_MASTERY_INVALID: 422,
  FOUNDATION_RECOMMENDATION_INVALID: 422,
  FOUNDATION_EXIT_ASSESSMENT_INVALID: 409,
  FOUNDATION_PROGRESS_INVALID_TRANSITION: 409,
  CANADIAN_PRACTICE_RULE_INVALID: 400,
  CANADIAN_PRACTICE_JURISDICTION_UNSUPPORTED: 422,
  CANADIAN_PRACTICE_SOURCE_REQUIRED: 422,
  CANADIAN_PRACTICE_VERSION_NOT_FOUND: 404,
  CANADIAN_PRACTICE_RULE_NOT_EFFECTIVE: 422,
};

export type HttpErrorResponse = Readonly<{
  status: number;
  body: ApiFailure;
}>;

export function mapErrorToHttp(error: unknown): HttpErrorResponse {
  const appError =
    error instanceof AppError
      ? error
      : new AppError({
          code: "INTERNAL_ERROR",
          userMessage: "Une erreur interne est survenue.",
          internalMessage: "Unhandled application error.",
          cause: error,
        });

  return {
    status: httpStatusByErrorCode[appError.code] ?? 500,
    body: apiFailure(appError),
  };
}
