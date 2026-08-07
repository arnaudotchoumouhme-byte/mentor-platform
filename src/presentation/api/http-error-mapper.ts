import { apiFailure, type ApiFailure } from "@/shared/api/contracts";
import { AppError } from "@/shared/errors/app-error";

const httpStatusByErrorCode: Readonly<Record<string, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
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
