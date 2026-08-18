import { describe, expect, it, vi } from "vitest";
import type { MentorAction } from "@/application/actions/mentor-actions";
import type { UseCase } from "@/application/contracts";
import { AppError } from "@/shared/errors/app-error";

vi.mock("@/infrastructure/database/sqlite/server-sqlite-executor", () => ({
  sqliteExecutor: { all: vi.fn(() => []), run: vi.fn() },
}));

import { createActionsPost } from "./route";

function request(body: string) {
  return new Request("http://localhost/api/actions", {
    method: "POST",
    headers: { "content-type": "application/json", "x-trace-id": "trace_test_12345" },
    body,
  });
}

function useCase(
  execute: UseCase<MentorAction, void>["execute"] = vi.fn(),
): UseCase<MentorAction, void> {
  return { execute };
}

describe("POST /api/actions", () => {
  it("accepts a valid action and returns the stable success body", async () => {
    const execute = vi.fn();
    const response = await createActionsPost(useCase(execute))(
      request(JSON.stringify({ action: "deleteDocument", id: 7 })),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(execute).toHaveBeenCalledWith({ action: "deleteDocument", id: 7 });
  });

  it.each([
    ["malformed JSON", "{"],
    ["missing action", JSON.stringify({ id: 1 })],
    ["unknown action", JSON.stringify({ action: "unknown", id: 1 })],
    ["invalid field", JSON.stringify({ action: "deleteDocument", id: "1" })],
  ])("rejects %s", async (_label, body) => {
    const response = await createActionsPost(useCase())(request(body));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Données invalides", traceId: "trace_test_12345", retriable: false },
    });
  });

  it("maps known application errors", async () => {
    const response = await createActionsPost(
      useCase(async () => {
        throw new AppError({ code: "CONFLICT", userMessage: "Conflit." });
      }),
    )(request(JSON.stringify({ action: "deleteDocument", id: 7 })));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: "CONFLICT", message: "Conflit.", traceId: "trace_test_12345", retriable: false },
    });
  });

  it("returns a stable 404 when the target resource is absent", async () => {
    const response = await createActionsPost(
      useCase(async () => {
        throw new AppError({
          code: "NOT_FOUND",
          userMessage: "Ressource introuvable.",
        });
      }),
    )(request(JSON.stringify({ action: "deleteDocument", id: 404 })));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Ressource introuvable.", traceId: "trace_test_12345", retriable: false },
    });
  });

  it("does not expose unexpected technical errors", async () => {
    const response = await createActionsPost(
      useCase(async () => {
        throw new Error("SQLITE_BUSY C:\\private\\mentor.db");
      }),
    )(request(JSON.stringify({ action: "deleteDocument", id: 7 })));
    const body = JSON.stringify(await response.json());
    expect(response.status).toBe(500);
    expect(body).not.toContain("SQLITE_BUSY");
    expect(body).not.toContain("private");
  });
});
