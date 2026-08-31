import { describe, expect, it, vi } from "vitest";
import type {
  ImportDocumentsInput,
  ImportDocumentsOutput,
} from "@/application/documents/import-documents";
import type { UseCase } from "@/application/contracts";

vi.mock("@/infrastructure/documents/server-document-import", () => ({
  importDocuments: { execute: vi.fn() },
}));

import { createDocumentsPost } from "./route";

function request(form: FormData) {
  return new Request("http://localhost/api/documents", { method: "POST", headers: { "x-trace-id": "trace_test_12345" }, body: form });
}

describe("POST /api/documents", () => {
  it("passes an HTTP upload to the application use case", async () => {
    const execute = vi.fn(async () => ({ imported: ["cours.txt"], rejected: [], documents: [] }));
    const useCase: UseCase<ImportDocumentsInput, ImportDocumentsOutput> = { execute };
    const form = new FormData();
    form.set("subject", "Pharmacologie");
    form.append("files", new File(["Cours"], "cours.txt", { type: "text/plain" }));

    const response = await createDocumentsPost(useCase)(request(form));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ imported: ["cours.txt"], rejected: [], documents: [] });
    expect(execute).toHaveBeenCalledWith({
      learnerId: "test",
      subject: "Pharmacologie",
      files: [
        expect.objectContaining({
          name: "cours.txt",
          browserMediaType: "text/plain",
          size: 5,
        }),
      ],
      traceId: expect.any(String),
    });
  });

  it("returns a stable validation error when no file is provided", async () => {
    const execute = vi.fn();
    const response = await createDocumentsPost({ execute })(request(new FormData()));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Aucun fichier sélectionné.", traceId: "trace_test_12345", retriable: false },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("hides unexpected persistence errors", async () => {
    const execute: UseCase<ImportDocumentsInput, ImportDocumentsOutput>["execute"] = async () => {
      throw new Error("SQLITE_BUSY C:\\private\\mentor.db");
    };
    const form = new FormData();
    form.append("files", new File(["Cours"], "cours.txt", { type: "text/plain" }));
    const response = await createDocumentsPost({ execute })(request(form));
    const body = JSON.stringify(await response.json());
    expect(response.status).toBe(500);
    expect(body).not.toContain("SQLITE_BUSY");
    expect(body).not.toContain("private");
  });

  it("rejects an oversized request before multipart materialization", async () => {
    const execute = vi.fn();
    const form = new FormData();
    form.append("files", new File(["x"], "cours.txt", { type: "text/plain" }));
    const oversized = request(form);
    const response = await createDocumentsPost({ execute })(
      new Request(oversized, { headers: { ...Object.fromEntries(oversized.headers), "content-length": "60000000" } }),
    );
    expect(response.status).toBe(413);
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects an invalid Content-Length", async () => {
    const form = new FormData();
    form.append("files", new File(["x"], "cours.txt", { type: "text/plain" }));
    const original = request(form);
    const response = await createDocumentsPost({ execute: vi.fn() })(
      new Request(original, { headers: { ...Object.fromEntries(original.headers), "content-length": "invalid" } }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a non-multipart request", async () => {
    const response = await createDocumentsPost({ execute: vi.fn() })(
      new Request("http://localhost/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(415);
  });

  it("rejects an excessive number of files", async () => {
    const form = new FormData();
    for (let index = 0; index < 11; index += 1) {
      form.append("files", new File(["x"], `cours-${index}.txt`, { type: "text/plain" }));
    }
    const response = await createDocumentsPost({ execute: vi.fn() })(request(form));
    expect(response.status).toBe(413);
  });

  it("rejects unexpected multipart fields", async () => {
    const form = new FormData();
    form.append("files", new File(["x"], "cours.txt", { type: "text/plain" }));
    form.set("unexpected", "value");
    const response = await createDocumentsPost({ execute: vi.fn() })(request(form));
    expect(response.status).toBe(400);
  });
});
