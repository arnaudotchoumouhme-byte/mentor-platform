import { describe, expect, it } from "vitest";
import {
  MAX_SUPPORTED_SCHEMA_VERSION,
  isMcqImportSchemaSupported,
  isSourceVersionAliasSchemaSupported,
} from "./operational-schema-support";

describe("operational schema support", () => {
  it("uses the current migration registry as the maximum supported schema", () => {
    expect(MAX_SUPPORTED_SCHEMA_VERSION).toBe(19);
  });

  it.each([
    [15, true],
    [16, true],
    [17, true],
    [18, true],
    [19, true],
    [20, false],
  ])("guards MCQ import at schema %i", (version, expected) => {
    expect(isMcqImportSchemaSupported(version)).toBe(expected);
  });

  it.each([
    [15, true],
    [16, true],
    [17, true],
    [18, true],
    [19, true],
    [20, false],
  ])("guards source-version aliases at schema %i", (version, expected) => {
    expect(isSourceVersionAliasSchemaSupported(version)).toBe(expected);
  });
});
