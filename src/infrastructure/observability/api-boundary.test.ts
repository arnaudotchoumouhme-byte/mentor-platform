import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/shared/errors/app-error";
import { apiErrorResponse } from "./api-boundary";

describe("API diagnostic boundary", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("propagates the same trace ID through header, body and structured log", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = apiErrorResponse(new AppError({ code: "DB_NOT_READY", userMessage: "Base indisponible.", category: "database", retriable: true }), { traceId: "trace_test_12345", module: "test", operation: "test.failure" });
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(response.headers.get("x-trace-id")).toBe("trace_test_12345");
    expect(body.error).toMatchObject({ code: "DB_NOT_READY", traceId: "trace_test_12345", retriable: true });
    expect(logged.mock.calls.flat().join(" ")).toContain("trace_test_12345");
  });
  it("does not expose secrets in logs", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    apiErrorResponse(new AppError({ code: "INTERNAL_ERROR", userMessage: "Erreur.", context: { token: "secret-value", cookie: "session-value" } }), { traceId: "trace_test_12345", module: "test", operation: "test.failure" });
    const output = logged.mock.calls.flat().join(" ");
    expect(output).not.toContain("secret-value"); expect(output).not.toContain("session-value"); expect(output).toContain("[REDACTED]");
  });
});
