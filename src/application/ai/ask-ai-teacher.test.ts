import { describe, expect, it, vi } from "vitest";
import type { Document } from "@/domain/documents/document";
import { AskAiTeacher } from "./ask-ai-teacher";
import type {
  ConversationMessage,
  DocumentKnowledgePort,
} from "./document-knowledge-port";

function createPort(documents: readonly Document[]): DocumentKnowledgePort {
  return {
    listSearchableDocuments: vi.fn().mockResolvedValue(documents),
    saveConversationMessage: vi.fn().mockResolvedValue(undefined),
  };
}

describe("AskAiTeacher", () => {
  it("returns the same local documentary response and persists both messages", async () => {
    const port = createPort([
      {
        id: 1,
        name: "Guide.pdf",
        content: "La biodisponibilité mesure la fraction absorbée.",
        archived: false,
      },
    ]);
    const useCase = new AskAiTeacher(port);

    const result = await useCase.execute({
      question: "Explique la biodisponibilité",
      mode: "Explication",
    });

    expect(result.support).toBe("Documentaire");
    expect(result.provider).toBe("Moteur local");
    expect(result.citations).toEqual([
      {
        document: "Guide.pdf",
        excerpt: "La biodisponibilité mesure la fraction absorbée.",
      },
    ]);
    expect(port.saveConversationMessage).toHaveBeenCalledTimes(2);
  });

  it("returns the existing insufficient-support response without documents", async () => {
    const saved: ConversationMessage[] = [];
    const port: DocumentKnowledgePort = {
      listSearchableDocuments: async () => [],
      saveConversationMessage: async (message) => {
        saved.push(message);
      },
    };

    const result = await new AskAiTeacher(port).execute({
      question: "Question inconnue",
      mode: "Explication",
    });

    expect(result.support).toBe("Insuffisant");
    expect(result.citations).toEqual([]);
    expect(saved).toHaveLength(2);
  });
});
