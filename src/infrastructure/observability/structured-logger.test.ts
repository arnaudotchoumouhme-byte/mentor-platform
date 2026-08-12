import { describe, expect, it } from "vitest";
import { redactLogValue } from "./structured-logger";

describe("structured logger redaction", () => {
  it("redacts secrets recursively without removing useful context", () => {
    expect(redactLogValue({ module: "health", token: "secret", nested: { apiKey: "key" } })).toEqual({
      module: "health",
      token: "[REDACTED]",
      nested: { apiKey: "[REDACTED]" },
    });
  });
});
