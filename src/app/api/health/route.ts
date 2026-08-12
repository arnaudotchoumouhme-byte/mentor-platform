import { config } from "@/infrastructure/config/server-config";
import { resolveTraceId } from "@/shared/observability/trace-id";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const traceId = resolveTraceId(request.headers.get("x-trace-id"));
  return Response.json(
    {
      status: "ok",
      version: process.env.npm_package_version ?? "development",
      environment: config.app.environment,
      traceId,
    },
    { headers: { "x-trace-id": traceId, "cache-control": "no-store" } },
  );
}
