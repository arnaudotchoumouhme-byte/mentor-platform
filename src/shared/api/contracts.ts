import type { AppError } from "@/shared/errors/app-error";

export type ApiSuccess<T> = Readonly<{
  success: true;
  data: T;
}>;

export type ApiFailure = Readonly<{
  success: false;
  error: Readonly<{
    code: string;
    message: string;
    traceId: string;
    retriable: boolean;
  }>;
}>;

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function apiFailure(error: AppError, traceId = "trace-unavailable"): ApiFailure {
  return {
    success: false,
    error: {
      code: error.code,
        message: error.userMessage,
        traceId,
        retriable: error.retriable,
    },
  };
}
