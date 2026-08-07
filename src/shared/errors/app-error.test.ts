import { describe, expect, it } from "vitest";
import { AppError } from "./app-error";

describe("AppError", () => {
  it("sépare le message public du diagnostic interne", () => {
    const error = new AppError({
      code: "DOCUMENT_NOT_FOUND",
      userMessage: "Document introuvable.",
      internalMessage: "Document 42 absent du repository.",
    });

    expect(error.userMessage).toBe("Document introuvable.");
    expect(error.message).toBe("Document 42 absent du repository.");
    expect(error.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("conserve la cause uniquement sur l'erreur serveur", () => {
    const cause = new Error("SQLITE_BUSY C:\\private\\mentor.db");
    const error = new AppError({
      code: "DATABASE_ERROR",
      userMessage: "Une erreur est survenue.",
      cause,
    });

    expect(error.cause).toBe(cause);
    expect(error.userMessage).not.toContain("SQLITE_BUSY");
  });
});
