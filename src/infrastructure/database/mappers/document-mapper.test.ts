import { describe, expect, it } from "vitest";
import { toDocument } from "./document-mapper";

describe("toDocument", () => {
  it("maps SQLite representation details to the domain model", () => {
    expect(
      toDocument({ id: 1, name: "Guide.pdf", content: "Texte", archived: 1 }),
    ).toEqual({
      id: 1,
      name: "Guide.pdf",
      content: "Texte",
      archived: true,
    });
  });
});
