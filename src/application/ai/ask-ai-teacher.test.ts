import { describe, expect, it, vi } from "vitest";
import { AskAiTeacher } from "./ask-ai-teacher";
import type { DocumentKnowledgePort } from "./document-knowledge-port";

const conversations = (): DocumentKnowledgePort => ({ listSearchableDocuments: vi.fn(async () => []), saveConversationMessage: vi.fn(async () => undefined) });
const candidate = {
  chunk: { chunkId: "c1", sourceId: "s1", sourceVersionId: "v1", sequence: 0, text: "La pharmacocinétique étudie ce que l’organisme fait au médicament.", charStart: 0, charEnd: 67, pageStart: 1, pageEnd: 1, sectionTitle: null, headingPath: [], approximateTokenCount: 17, contentHash: "hash", indexStatus: "INDEXED" as const, language: "fr", provenance: "USER_UPLOAD" },
  displayName: "Guide.pdf", lexicalScore: 1, semanticScore: 0.9, score: 0.94, rank: 1,
};

describe("AskAiTeacher evidence-first", () => {
  it("returns only validated evidence and persists both messages", async () => {
    const port = conversations();
    const citation = { citationId: "citation-c1", sourceId: "s1", documentId: 1, sourceVersionId: "v1", chunkId: "c1", displayName: "Guide.pdf", pageStart: 1, pageEnd: 1, sectionTitle: null, excerpt: candidate.chunk.text, retrievalScore: 0.94, rank: 1, provenance: "USER_UPLOAD" };
    const useCase = new AskAiTeacher(port, { execute: () => 1 }, { retrieve: () => [candidate] }, { evaluate: () => ({ status: "SUFFICIENT", reason: "EVIDENCE_FOUND", evidence: [candidate] }) }, { build: () => [citation] }, () => 1);
    const result = await useCase.execute({ question: "Explique la pharmacocinétique", mode: "Explication" });
    expect(result).toMatchObject({ support: "Documentaire", evidenceStatus: "SUFFICIENT" });
    expect(result.answer).toContain(candidate.chunk.text);
    expect(result.citations[0]).toMatchObject({ chunkId: "c1", pageStart: 1, document: "Guide.pdf" });
    expect(port.saveConversationMessage).toHaveBeenCalledTimes(2);
  });

  it("refuses without evidence and emits no citation or claim", async () => {
    const port = conversations();
    const useCase = new AskAiTeacher(port, { execute: () => 0 }, { retrieve: () => [] }, { evaluate: () => ({ status: "NONE", reason: "NO_INDEXED_DOCUMENTS", evidence: [] }) }, { build: () => [] }, () => 0);
    const result = await useCase.execute({ question: "Question inconnue", mode: "Explication" });
    expect(result).toMatchObject({ support: "Insuffisant", citations: [], claims: [] });
    expect(result.answer).toContain("Appui documentaire insuffisant");
  });
});
