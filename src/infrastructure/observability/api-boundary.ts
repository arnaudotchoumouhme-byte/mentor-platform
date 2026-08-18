import "server-only";

import { NextResponse } from "next/server";
import { mapErrorToHttp } from "@/presentation/api/http-error-mapper";
import { AppError } from "@/shared/errors/app-error";
import { structuredLogger } from "./structured-logger";

type ApiBoundaryContext = Readonly<{
  traceId: string;
  module: string;
  operation: string;
}>;

export function apiErrorResponse(error: unknown, context: ApiBoundaryContext) {
  const mapped = mapErrorToHttp(error, context.traceId);
  const appError = error instanceof AppError ? error : null;
  structuredLogger.log({
    level: appError?.severity ?? "error",
    module: context.module,
    operation: context.operation,
    status: "failure",
    message: appError ? `Request failed (${appError.code}).` : "Unhandled application error.",
    traceId: context.traceId,
    errorCode: mapped.body.error.code,
    context: appError?.context,
  });
  return NextResponse.json(mapped.body, {
    status: mapped.status,
    headers: { "x-trace-id": context.traceId, "cache-control": "no-store" },
  });
}

export function apiValidationError(message: string, context: ApiBoundaryContext) {
  return apiErrorResponse(
    new AppError({
      code: "VALIDATION_ERROR",
      userMessage: message,
      category: "validation",
      severity: "warn",
    }),
    context,
  );
}
