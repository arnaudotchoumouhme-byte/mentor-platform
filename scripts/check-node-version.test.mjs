import { describe, expect, it } from "vitest";
import {
  MINIMUM_NODE_VERSION,
  nodeVersionError,
  parseNodeVersion,
  supportsNodeVersion,
} from "./check-node-version.mjs";

describe("Node.js version guard", () => {
  it.each([
    ["23.11.0", false],
    ["24.0.0", true],
    ["24.4.1", true],
    ["25.0.0", true],
    ["invalid", false],
  ])("evaluates %s", (version, expected) => {
    expect(supportsNodeVersion(version)).toBe(expected);
  });

  it("parses the detected semantic version", () => {
    expect(parseNodeVersion("24.1.2")).toEqual([24, 1, 2]);
  });

  it("produces an actionable error with detected and minimum versions", () => {
    expect(nodeVersionError("22.0.0")).toContain("22.0.0");
    expect(nodeVersionError("22.0.0")).toContain(MINIMUM_NODE_VERSION);
  });
});
