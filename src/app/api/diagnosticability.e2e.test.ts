// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReadinessGet } from "./readiness/route";
import { createStateGet } from "./state/route";
import { apiErrorResponse } from "@/infrastructure/observability/api-boundary";
import type { RuntimeReadiness } from "@/infrastructure/diagnostics/runtime-readiness";
import { AppError } from "@/shared/errors/app-error";
import { useAppState, type AppStateStatus } from "@/hooks/use-state";

const traceId = "trace_e2e_diagnostics_12345";
const sensitiveValues = ["auth0|private-user", "private@example.test", "private clinical prompt", "secret-token"];
const readyChecks: RuntimeReadiness["checks"] = {
  persistentStorage: "ready",
  database: "ready",
  schema: { status: "ready", currentVersion: 13, targetVersion: 13 },
  migrations: { status: "ready", pending: 0 },
  auth0: "ready",
  foundation: "ready",
  mcq: "ready",
  osce: "ready",
  calculations: "ready",
  imports: "ready",
  ai: "disabled",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function assertDiagnosticCase(
  response: Response,
  log: ReturnType<typeof vi.spyOn>,
  expected: Readonly<{ status: number; code: string; ui: AppStateStatus }>,
) {
  const body = await response.clone().json();
  const serializedResponse = JSON.stringify(body);
  const serializedLog = log.mock.calls.flat().join(" ");

  expect(response.status).toBe(expected.status);
  expect(body.error).toMatchObject({ code: expected.code, traceId, retriable: expect.any(Boolean) });
  expect(typeof body.error.message).toBe("string");
  expect(response.headers.get("x-trace-id")).toBe(traceId);
  expect(serializedLog).toContain(traceId);
  for (const sensitive of sensitiveValues) {
    expect(serializedResponse).not.toContain(sensitive);
    expect(serializedLog).not.toContain(sensitive);
  }

  vi.stubGlobal("fetch", vi.fn(async () => response.clone()));
  const hook = renderHook(() => useAppState());
  await waitFor(() => expect(hook.result.current.status).not.toBe("loading"));
  expect(hook.result.current.status).toBe(expected.ui);
  expect(hook.result.current.diagnostic.traceId).toBe(traceId);
}

describe("diagnosticability end-to-end", () => {
  it("correlates a missing Auth0 configuration through readiness and UI", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = createReadinessGet(() => ({ status: "not-ready", checks: { ...readyChecks, auth0: "not-ready" } }))(
      new Request("http://localhost/api/readiness", { headers: { "x-trace-id": traceId } }),
    );
    const body = await response.clone().json();
    expect(body.checks.auth0).toBe("not-ready");
    await assertDiagnosticCase(response, log, { status: 503, code: "CFG_AUTH0_INCOMPLETE", ui: "server-error" });
  });

  it("correlates denied pilot access without exposing the Auth0 subject", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await createStateGet(async () => {
      throw new AppError({
        code: "PILOT_ACCESS_DENIED",
        userMessage: "Accès au pilote refusé.",
        category: "security",
        severity: "warn",
        context: { oidcSubject: sensitiveValues[0], email: sensitiveValues[1] },
      });
    })(new Request("http://localhost/api/state", { headers: { "x-trace-id": traceId } }));
    await assertDiagnosticCase(response, log, { status: 403, code: "PILOT_ACCESS_DENIED", ui: "access-denied" });
  });

  it("identifies a database readiness failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = createReadinessGet(() => ({ status: "not-ready", checks: { ...readyChecks, database: "not-ready", foundation: "not-ready", mcq: "not-ready", osce: "not-ready", calculations: "not-ready", imports: "not-ready" } }))(
      new Request("http://localhost/api/readiness", { headers: { "x-trace-id": traceId } }),
    );
    const body = await response.clone().json();
    expect(body.checks.database).toBe("not-ready");
    await assertDiagnosticCase(response, log, { status: 503, code: "DB_NOT_READY", ui: "server-error" });
  });

  it("correlates a controlled internal API error without leaking its context", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = apiErrorResponse(
      new AppError({
        code: "INTERNAL_ERROR",
        userMessage: "Une erreur interne est survenue.",
        internalMessage: sensitiveValues[2],
        context: { prompt: sensitiveValues[2], token: sensitiveValues[3] },
      }),
      { traceId, module: "diagnostics", operation: "diagnostics.controlled-failure" },
    );
    await assertDiagnosticCase(response, log, { status: 500, code: "INTERNAL_ERROR", ui: "server-error" });
  });
});
