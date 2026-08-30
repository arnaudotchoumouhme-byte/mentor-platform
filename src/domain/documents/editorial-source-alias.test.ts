import { describe, expect, it } from "vitest";
import { EditorialSourceAliasError, parseEditorialSourceAlias } from "./editorial-source-alias";

describe("EditorialSourceAlias", () => {
  it("accepts a canonical editorial alias", () => {
    expect(parseEditorialSourceAlias("SNC-COURS-2026-04-28/V1")).toBe("SNC-COURS-2026-04-28/V1");
  });

  it.each(["snc/V1", "SNC/V0", "SNC/v1", " SNC/V1", "SNC/V1 ", "SNC V1"])(
    "rejects non-canonical value %s",
    (value) => expect(() => parseEditorialSourceAlias(value)).toThrow(EditorialSourceAliasError),
  );
});
