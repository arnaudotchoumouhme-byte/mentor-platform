import type { UseCase } from "@/application/contracts";
import type { Document } from "@/domain/documents/document";
import type { DocumentKnowledgePort } from "./document-knowledge-port";

export type AskAiTeacherInput = Readonly<{
  question: string;
  mode: string;
}>;

export type Citation = Readonly<{
  document: string;
  excerpt: string;
}>;

export type AskAiTeacherOutput = Readonly<{
  answer: string;
  citations: readonly Citation[];
  support: "Documentaire" | "Insuffisant";
  provider: "Moteur local";
}>;

function relevanceScore(document: Document, words: readonly string[]) {
  const content = document.content.toLowerCase();
  return words.reduce(
    (score, word) => score + (content.includes(word) ? 1 : 0),
    0,
  );
}

export class AskAiTeacher
  implements UseCase<AskAiTeacherInput, AskAiTeacherOutput>
{
  constructor(private readonly documents: DocumentKnowledgePort) {}

  async execute(input: AskAiTeacherInput): Promise<AskAiTeacherOutput> {
    const words = input.question
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3);
    const ranked = (await this.documents.listSearchableDocuments())
      .map((document) => ({
        document,
        score: relevanceScore(document, words),
      }))
      .sort((left, right) => right.score - left.score);
    const sources = ranked.filter(({ score }) => score > 0).slice(0, 3);
    const citations = sources.map(({ document }) => ({
      document: document.name,
      excerpt: document.content.slice(0, 220),
    }));
    const answer = sources.length
      ? `${input.mode} fondée sur votre bibliothèque : ${sources
          .map(({ document }) => document.content)
          .join(" ")
          .slice(0, 900)}\n\nÀ retenir : vérifiez toujours le contexte clinique et la version de la source.`
      : "Je n’ai trouvé aucun passage suffisamment pertinent dans la bibliothèque active. Essayez une formulation plus précise ou importez une source sur ce thème.";

    await this.documents.saveConversationMessage({
      role: "user",
      content: input.question,
      citations: "[]",
    });
    await this.documents.saveConversationMessage({
      role: "assistant",
      content: answer,
      citations: JSON.stringify(citations),
    });

    return {
      answer,
      citations,
      support: sources.length ? "Documentaire" : "Insuffisant",
      provider: "Moteur local",
    };
  }
}
