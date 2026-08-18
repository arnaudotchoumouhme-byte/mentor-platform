import { NextResponse } from "next/server";
import type { PilotIdentity } from "@/application/pilot/pilot-core";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";
import { SqliteLibrarySources } from "@/infrastructure/database/sqlite/sqlite-library-sources";
import { apiErrorResponse, apiValidationError } from "@/infrastructure/observability/api-boundary";
import { AppError } from "@/shared/errors/app-error";
import { resolveTraceId } from "@/shared/observability/trace-id";

const library = new SqliteLibrarySources(sqliteExecutor);
export function createDocumentGet(identity: () => Promise<PilotIdentity>) {
  return async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const traceId = resolveTraceId(request.headers.get("x-trace-id"));
    try {
      await identity(); const id = Number((await params).id);
      if (!Number.isSafeInteger(id) || id <= 0) return apiValidationError("Identifiant invalide.", { traceId, module: "documents", operation: "document.read" });
      const document = library.getByDocumentId(id);
      if (!document) throw new AppError({ code: "NOT_FOUND", userMessage: "Document introuvable." });
      return NextResponse.json(document, { headers: { "x-trace-id": traceId, "cache-control": "no-store" } });
    } catch (error) { return apiErrorResponse(error, { traceId, module: "documents", operation: "document.read" }); }
  };
}
export const GET = createDocumentGet(async () => (await import("@/infrastructure/pilot/server-pilot")).requirePilotIdentity());
