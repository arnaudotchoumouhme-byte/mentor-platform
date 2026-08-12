import { describe, expect, it } from "vitest";
import { createTraceId, resolveTraceId } from "./trace-id";

describe("trace id", () => {
  it("creates unique correlation identifiers", () => {
    expect(createTraceId()).not.toBe(createTraceId());
  });

  it("preserves a valid incoming identifier", () => {
    expect(resolveTraceId("request_12345678")).toBe("request_12345678");
  });

  it("replaces malformed identifiers", () => {
    expect(resolveTraceId("contains sensitive spaces")).toMatch(/^[\w-]{8,128}$/);
  });
});
