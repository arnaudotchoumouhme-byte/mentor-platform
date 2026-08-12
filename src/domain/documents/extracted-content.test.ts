import { describe, expect, it } from "vitest";
import { normalizeExtractedText } from "./extracted-content";

describe("normalizeExtractedText", () => {
  it("normalise Unicode, espaces, lignes et caractères invisibles", () => {
    expect(normalizeExtractedText(" Cafe\u0301\u0000  \r\n ligne\u200B\n\n\nfin ")).toBe(
      "Café\nligne\n\nfin",
    );
  });
});
