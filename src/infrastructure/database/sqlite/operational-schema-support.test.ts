import { describe, expect, it } from "vitest";
import {
  MAX_SUPPORTED_SCHEMA_VERSION,
  isMcqImportSchemaSupported,
  isSourceVersionAliasSchemaSupported,
} from "./operational-schema-support";

describe("operational schema support", () => {
  it("uses the current migration registry as the maximum supported schema", () => {
    expect(MAX_SUPPORTED_SCHEMA_VERSION).toBe(16);
  });

  it.each([
    [15, true],
    [16, true],
    [17, false],
  ])("guards MCQ import at schema %i", (version, expected) => {
    expect(isMcqImportSchemaSupported(version)).toBe(expected);
  });

  it.each([
    [15, true],
    [16, true],
    [17, false],
  ])("guards source-version aliases at schema %i", (version, expected) => {
    expect(isSourceVersionAliasSchemaSupported(version)).toBe(expected);
  });
});
