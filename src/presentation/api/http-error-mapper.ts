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
