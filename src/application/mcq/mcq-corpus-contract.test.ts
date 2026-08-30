import { describe, expect, it } from "vitest";
import { parseMcqCorpus } from "./mcq-corpus-contract";

export const validCorpus = () => ({ schemaVersion: "MCQ_CORPUS/1" as const, corpusId: "pebc-part1", corpusVersion: 1, blueprintVersionId: "blueprint-2027", items: [{ itemId: "item-1", version: 1, status: "PUBLISHED" as const, stem: "Énoncé validé", choices: [{ id: "a", text: "Choix A" }, { id: "b", text: "Choix B" }], correctChoiceId: "a", explanation: "Justification validée", difficulty: "FOUNDATION" as const, source: { sourceVersionId: "00000000-0000-4000-8000-000000000001", reference: { type: "PAGE" as const, locator: "12", label: "Référence p. 12" } }, mappings: [{ domainId: "domain", competencyId: "competency", topicId: "topic", objectiveIds: ["objective"] }] }] });

describe("MCQ corpus contract", () => {
  it("accepts the strict versioned contract", () => { expect(parseMcqCorpus(validCorpus())).toMatchObject({ schemaVersion: "MCQ_CORPUS/1", items: [{ status: "PUBLISHED" }] }); });
  it("rejects unknown fields and incomplete provenance", () => { expect(() => parseMcqCorpus({ ...validCorpus(), unexpected: true })).toThrow(); const corpus = validCorpus(); expect(() => parseMcqCorpus({ ...corpus, items: [{ ...corpus.items[0], source: {} }] })).toThrow(); });
  it("rejects an editorial alias used directly as sourceVersionId", () => { const corpus = validCorpus(); expect(() => parseMcqCorpus({ ...corpus, items: [{ ...corpus.items[0], source: { ...corpus.items[0].source, sourceVersionId: "SNC-COURS-2026-04-28/V1" } }] })).toThrow(); });
});
