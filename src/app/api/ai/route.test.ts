import { describe, expect, it, vi } from "vitest";
import type {
  AskAiTeacherInput,
  AskAiTeacherOutput,
} from "@/application/ai/ask-ai-teacher";
import type { UseCase } from "@/application/contracts";
import { AppError } from "@/shared/errors/app-error";

vi.mock("@/infrastructure/database/sqlite/server-sqlite-executor", () => ({
  sqliteExecutor: { all: vi.fn(() => []), run: vi.fn() },
}));

import { createAiPost } from "./route";

function request(body: string) {
  return new Request("http://localhost/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json", "x-trace-id": "trace_test_12345" },
    body,
  });
}

type AiUseCase = UseCase<AskAiTeacherInput, AskAiTeacherOutput>;

describe("POST /api/ai", () => {
  it("returns a successful application response unchanged", async () => {
    const output: AskAiTeacherOutput = {
      answer: "Réponse",
      citations: [],
      claims: [],
      support: "Insuffisant",
      provider: "Moteur local",
      evidenceStatus: "NONE",
    };
    const execute = vi.fn(async () => output);
    const response = await createAiPost({ execute })(
      request(JSON.stringify({ question: "Une question ?" })),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(output);
    expect(execute).toHaveBeenCalledWith({
      learnerId: "test",
      question: "Une question ?",
      mode: "Explication",
      traceId: expect.any(String),
    });
  });

  it.each([
    ["malformed JSON", "{"],
    ["missing question", JSON.stringify({ mode: "Résumé" })],
    ["short question", JSON.stringify({ question: "a" })],
  ])("rejects %s with the stable public message", async (_label, body) => {
    const execute = vi.fn() as AiUseCase["execute"];
    const response = await createAiPost({ execute })(request(body));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "La question doit être précisée.",
        traceId: "trace_test_12345",
        retriable: false,
      },
    });
  });

  it("maps known application errors", async () => {
    const execute: AiUseCase["execute"] = async () => {
      throw new AppError({ code: "VALIDATION_ERROR", userMessage: "Question invalide." });
    };
    const response = await createAiPost({ execute })(
      request(JSON.stringify({ question: "Question valide" })),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Question invalide.", traceId: "trace_test_12345", retriable: false },
    });
  });

  it("hides unexpected error details", async () => {
    const execute: AiUseCase["execute"] = async () => {
      throw new Error("secret token and C:\\private\\mentor.db");
    };
    const response = await createAiPost({ execute })(
      request(JSON.stringify({ question: "Question valide" })),
    );
    const body = JSON.stringify(await response.json());
    expect(response.status).toBe(500);
    expect(body).not.toContain("secret token");
    expect(body).not.toContain("private");
  });
});
