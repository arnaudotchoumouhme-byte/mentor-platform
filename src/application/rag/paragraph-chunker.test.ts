import { describe, expect, it } from "vitest";
import { ParagraphChunker } from "./paragraph-chunker";

function chunker() { let id = 0; return new ParagraphChunker({ id: () => `chunk-${++id}`, hash: (text) => `hash-${text.length}` }, { targetCharacters: 80, maximumCharacters: 120, overlapCharacters: 15 }); }
const input = (text: string) => ({ sourceId: "source", sourceVersionId: "version", text, provenance: "TEST_FIXTURE" });

describe("ParagraphChunker", () => {
  it("creates stable non-empty sentence-aware chunks with overlap", () => {
    const text = "Titre pharmacologie. La pharmacocinétique décrit l’absorption. La pharmacodynamie décrit les effets. Dernier paragraphe utile.";
    const first = chunker().chunk(input(text));
    const second = chunker().chunk(input(text));
    expect(first.length).toBeGreaterThan(1);
    expect(first.every((chunk) => chunk.text.length > 0 && chunk.text.length <= 120)).toBe(true);
    expect(first.map(({ text: value }) => value)).toEqual(second.map(({ text: value }) => value));
    expect(first[1].charStart).toBeLessThan(first[0].charEnd);
  });

  it("preserves unicode and a known single PDF page", () => {
    const chunks = chunker().chunk({ ...input("Élimination rénale et métabolisme hépatique."), pages: [{ pageNumber: 7, text: "Élimination rénale et métabolisme hépatique." }] });
    expect(chunks[0]).toMatchObject({ pageStart: 7, pageEnd: 7, sequence: 0 });
    expect(chunks[0].text).toContain("Élimination");
  });
});
