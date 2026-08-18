import { inspectServerReadiness } from "@/infrastructure/diagnostics/server-readiness";
import type { RuntimeReadiness } from "@/infrastructure/diagnostics/runtime-readiness";
import { structuredLogger } from "@/infrastructure/observability/structured-logger";
import { resolveTraceId } from "@/shared/observability/trace-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readinessErrorCode(readiness: RuntimeReadiness): string {
  if (readiness.checks.persistentStorage !== "ready") return "FS_PERSISTENT_STORAGE_NOT_MOUNTED";
  if (readiness.checks.database !== "ready") return "DB_NOT_READY";
  if (readiness.checks.schema.status !== "ready") {
    if (readiness.checks.schema.currentVersion === null) return "DB_MIGRATION_HISTORY_INVALID";
    if (readiness.checks.schema.currentVersion < readiness.checks.schema.targetVersion) return "DB_SCHEMA_OUTDATED";
    if (readiness.checks.schema.currentVersion > readiness.checks.schema.targetVersion) return "DB_SCHEMA_AHEAD";
    return "DB_MIGRATION_HISTORY_INVALID";
  }
  if (readiness.checks.migrations.status !== "ready") return "DB_MIGRATION_HISTORY_INVALID";
  if (readiness.checks.auth0 !== "ready") return "CFG_AUTH0_INCOMPLETE";
  return "RUNTIME_NOT_READY";
}

export function createReadinessGet(inspect: typeof inspectServerReadiness = inspectServerReadiness) { return function GET(request: Request) {
  const traceId = resolveTraceId(request.headers.get("x-trace-id"));
  const readiness = inspect();
  const errorCode = readiness.status === "ready" ? undefined : readinessErrorCode(readiness);
  structuredLogger.log({ level: readiness.status === "ready" ? "info" : "error", module: "runtime", operation: "readiness.inspect", status: readiness.status === "ready" ? "success" : "failure", message: `Runtime readiness ${readiness.status}.`, traceId, errorCode });
  return Response.json({
    ...readiness,
    version: process.env.npm_package_version ?? "development",
    traceId,
    ...(errorCode ? { error: { code: errorCode, message: "Le service n’est pas prêt. Consultez les contrôles de readiness.", traceId, retriable: true } } : {}),
  }, { status: readiness.status === "ready" ? 200 : 503, headers: { "x-trace-id": traceId, "cache-control": "no-store" } });
}; }
export const GET = createReadinessGet();
