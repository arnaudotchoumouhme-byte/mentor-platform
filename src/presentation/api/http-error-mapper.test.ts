import { describe, expect, it } from "vitest";
import { AppError } from "@/shared/errors/app-error";
import { mapErrorToHttp } from "./http-error-mapper";

describe("mapErrorToHttp", () => {
  it("maps a stable application code to HTTP", () => {
    const result = mapErrorToHttp(
      new AppError({
        code: "VALIDATION_ERROR",
        userMessage: "Données invalides.",
      }),
    );

    expect(result).toEqual({
      status: 400,
      body: {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Données invalides." },
      },
    });
  });

  it("hides unknown technical errors", () => {
    const result = mapErrorToHttp(new Error("secret internal path"));

    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).not.toContain("secret internal path");
  });
});
