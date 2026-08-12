import { describe, expect, it } from "vitest";
import { LocalEvidenceGate } from "./local-evidence-gate";

const candidate = (text: string, score: number, id = "c1") => ({ chunk: { chunkId: id, sourceId: "s", sourceVersionId: "v", sequence: 0, text, charStart: 0, charEnd: text.length, pageStart: null, pageEnd: null, sectionTitle: null, headingPath: [], approximateTokenCount: 10, contentHash: "h", indexStatus: "INDEXED" as const, language: "fr", provenance: "TEST_FIXTURE" }, displayName: "fixture", lexicalScore: score, semanticScore: score, score, rank: 1 });

describe("LocalEvidenceGate", () => {
  const gate = new LocalEvidenceGate();
  const question = "différence pharmacocinétique pharmacodynamie";
  it("accepts complementary multi-source evidence", () => {
    expect(gate.evaluate(question, [candidate("La pharmacocinétique étudie le devenir du médicament.", .8), candidate("La pharmacodynamie étudie les effets du médicament.", .75, "c2")], 2).status).toBe("SUFFICIENT");
  });
  it("rejects an unrelated beta-blocker passage", () => {
    expect(gate.evaluate(question, [candidate("Les bêtabloquants diminuent la fréquence cardiaque.", .2)], 1)).toMatchObject({ status: "INSUFFICIENT", evidence: [] });
  });
  it("returns NONE when nothing is indexed", () => {
    expect(gate.evaluate(question, [], 0)).toMatchObject({ status: "NONE", reason: "NO_INDEXED_DOCUMENTS" });
  });
});
