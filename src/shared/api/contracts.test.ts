import { describe, expect, it } from "vitest";
import { AppError } from "@/shared/errors/app-error";
import { apiFailure, apiSuccess } from "./contracts";

describe("API contracts", () => {
  it("wraps successful data", () => {
    expect(apiSuccess({ id: 1 })).toEqual({ success: true, data: { id: 1 } });
  });

  it("never exposes an internal error message", () => {
    const error = new AppError({
      code: "DATABASE_ERROR",
      userMessage: "Une erreur est survenue.",
      internalMessage: "SQLITE_BUSY on C:\\private\\mentor.db",
    });

    expect(apiFailure(error)).toEqual({
      success: false,
      error: {
        code: "DATABASE_ERROR",
        message: "Une erreur est survenue.",
      },
    });
    expect(JSON.stringify(apiFailure(error))).not.toContain("SQLITE_BUSY");
  });
});
