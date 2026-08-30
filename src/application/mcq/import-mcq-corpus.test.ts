import { describe, expect, it, vi } from "vitest";
import { ImportMcqCorpus } from "./import-mcq-corpus";
import { parseMcqCorpus } from "./mcq-corpus-contract";
import { validCorpus } from "./mcq-corpus-contract.test";

describe("ImportMcqCorpus", () => {
  it("normalizes items and delegates one atomic batch", async () => { const writer = { import: vi.fn(async items => ({ created: items.length, unchanged: 0 })) }; const result = await new ImportMcqCorpus(writer, { checksum: () => "checksum" }, { now: () => "2026-08-19T00:00:00.000Z" }).execute(parseMcqCorpus(validCorpus())); expect(result).toEqual({ created: 1, unchanged: 0 }); expect(writer.import).toHaveBeenCalledWith([expect.objectContaining({ question: expect.objectContaining({ itemId: "item-1", correctChoiceId: "a", mappings: [expect.objectContaining({ blueprintVersionId: "blueprint-2027" })] }), editorial: expect.objectContaining({ contentChecksum: "checksum", sourceVersionId: "00000000-0000-4000-8000-000000000001" }) })]); });
  it("rejects duplicate item versions before persistence", async () => { const writer = { import: vi.fn() }; const corpus = validCorpus(); await expect(new ImportMcqCorpus(writer, { checksum: () => "checksum" }, { now: () => "now" }).execute(parseMcqCorpus({ ...corpus, items: [corpus.items[0], corpus.items[0]] }))).rejects.toMatchObject({ code: "MCQ_CORPUS_DUPLICATE_ITEM" }); expect(writer.import).not.toHaveBeenCalled(); });
});
