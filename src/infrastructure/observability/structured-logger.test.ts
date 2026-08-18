import { afterEach, describe, expect, it, vi } from "vitest";
import { redactLogValue, structuredLogger } from "./structured-logger";

afterEach(() => vi.restoreAllMocks());

describe("structured logger redaction", () => {
  it("redacts secrets recursively without removing useful context", () => {
    expect(redactLogValue({ module: "health", token: "secret", nested: { apiKey: "key" } })).toEqual({
      module: "health",
      token: "[REDACTED]",
      nested: { apiKey: "[REDACTED]" },
    });
  });

  it("redacts deeply nested identity, PII and user content, including arrays", () => {
    const cleartext = {
      context: {
        request: {
          oidcSubject: "auth0|pilot-user",
          actorSubject: "google-oauth2|operator-user",
          profile: { email: "pilot@example.test", patientName: "Jane Doe" },
        },
        attempts: [
          { prompt: "Explain this private clinical case", answer: "Private patient answer" },
          { nested: [{ token: "deep-secret" }, { clinicalNotes: ["Sensitive note"] }] },
          "someone@example.test",
          "oidc|raw-subject",
        ],
      },
    };

    const serialized = JSON.stringify(redactLogValue(cleartext));

    for (const sensitiveValue of [
      "auth0|pilot-user",
      "google-oauth2|operator-user",
      "pilot@example.test",
      "Jane Doe",
      "Explain this private clinical case",
      "Private patient answer",
      "deep-secret",
      "Sensitive note",
      "someone@example.test",
      "oidc|raw-subject",
    ]) {
      expect(serialized).not.toContain(sensitiveValue);
    }
    expect(serialized).toContain("[REDACTED]");
  });

  it("never serializes sensitive context in the structured logger output", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    structuredLogger.log({
      level: "info",
      module: "pilot",
      operation: "pilot.audit",
      status: "success",
      message: "Audit completed.",
      traceId: "trace-safe",
      context: {
        batches: [{ users: [{ sub: "auth0|nested-user", email: "nested@example.test" }] }],
        payload: [{ userInput: "private prompt" }, { privateKey: "private-key-value" }],
      },
    });

    const serialized = String(info.mock.calls[0]?.[0]);
    expect(serialized).toContain("trace-safe");
    expect(serialized).toContain("Audit completed.");
    expect(serialized).not.toContain("auth0|nested-user");
    expect(serialized).not.toContain("nested@example.test");
    expect(serialized).not.toContain("private prompt");
    expect(serialized).not.toContain("private-key-value");
  });
});
