import type { UseCase } from "@/application/contracts";
import type { EvidenceCitation, SupportedClaim } from "@/domain/rag/citation";
import type { DocumentKnowledgePort } from "./document-knowledge-port";
import type { CitationBuilder, EvidenceGate, Retriever } from "@/application/rag/rag-ports";

export type AskAiTeacherInput = Readonly<{ question: string; mode: string; traceId?: string }>;
export type Citation = EvidenceCitation & Readonly<{ document: string; excerpt: string }>;
export type AskAiTeacherOutput = Readonly<{
  answer: string; citations: readonly Citation[]; claims: readonly SupportedClaim[];
  support: "Documentaire" | "Insuffisant"; provider: "Moteur local"; evidenceStatus: string;
}>;
export interface RagLoggerPort { event(input: Readonly<{ name: string; traceId?: string; status: "success" | "failure" | "degraded"; context?: Readonly<Record<string, unknown>> }>): void; }
export interface RagIndexingPort { execute(): number; }

export class AskAiTeacher implements UseCase<AskAiTeacherInput, AskAiTeacherOutput> {
  constructor(
    private readonly conversations: DocumentKnowledgePort,
    private readonly indexer: RagIndexingPort,
    private readonly retriever: Retriever,
    private readonly gate: EvidenceGate,
    private readonly citationBuilder: CitationBuilder,
    private readonly indexedCount: () => number,
    private readonly logger?: RagLoggerPort,
  ) {}

  async execute(input: AskAiTeacherInput): Promise<AskAiTeacherOutput> {
    const startedAt = Date.now();
    this.logger?.event({ name: "rag.query.started", status: "success", traceId: input.traceId });
    try {
      const indexed = this.indexer.execute();
      const candidates = this.retriever.retrieve(input.question);
      this.logger?.event({ name: "rag.lexical.completed", status: "success", traceId: input.traceId, context: { candidateCount: candidates.filter(({ lexicalScore }) => lexicalScore > 0).length } });
      this.logger?.event({ name: "rag.semantic.completed", status: "success", traceId: input.traceId, context: { candidateCount: candidates.filter(({ semanticScore }) => semanticScore > 0).length } });
      this.logger?.event({ name: "rag.rerank.completed", status: "degraded", traceId: input.traceId, context: { enabled: false } });
      this.logger?.event({ name: "rag.candidates.merged", status: "success", traceId: input.traceId, context: { candidateCount: candidates.length, newlyIndexedChunks: indexed } });
      const decision = this.gate.evaluate(input.question, candidates, this.indexedCount());
      this.logger?.event({ name: "rag.evidence_gate.completed", status: decision.status === "SUFFICIENT" ? "success" : "degraded", traceId: input.traceId, context: { evidenceStatus: decision.status, reason: decision.reason } });
      const built = decision.status === "SUFFICIENT" ? this.citationBuilder.build(decision.evidence) : [];
      this.logger?.event({ name: "rag.context.assembled", status: decision.status === "SUFFICIENT" ? "success" : "degraded", traceId: input.traceId, context: { evidenceCount: decision.evidence.length } });
      const citations: Citation[] = built.map((citation) => ({ ...citation, document: citation.displayName, excerpt: citation.excerpt }));
      const supported = decision.status === "SUFFICIENT" && citations.length === decision.evidence.length;
      const claims: SupportedClaim[] = supported ? citations.map((citation) => ({ text: citation.excerpt, citationIds: [citation.citationId] })) : [];
      const answer = supported
        ? `${input.mode} fondée exclusivement sur les passages retrouvés :\n\n${citations.map((citation, index) => `[${index + 1}] ${citation.excerpt}`).join("\n\n")}`
        : "Appui documentaire insuffisant. Je n’ai trouvé aucun passage suffisamment pertinent dans votre bibliothèque. Reformulez la question ou importez une source adaptée.";
      const output: AskAiTeacherOutput = { answer, citations: supported ? citations : [], claims, support: supported ? "Documentaire" : "Insuffisant", provider: "Moteur local", evidenceStatus: supported ? "SUFFICIENT" : decision.status };
      await this.conversations.saveConversationMessage({ role: "user", content: input.question, citations: "[]" });
      await this.conversations.saveConversationMessage({ role: "assistant", content: answer, citations: JSON.stringify(output.citations) });
      this.logger?.event({ name: "rag.answer.generated", status: supported ? "success" : "degraded", traceId: input.traceId, context: { grounded: supported } });
      this.logger?.event({ name: "rag.citations.validated", status: supported ? "success" : "degraded", traceId: input.traceId, context: { citationCount: output.citations.length } });
      this.logger?.event({ name: "rag.query.completed", status: supported ? "success" : "degraded", traceId: input.traceId, context: { durationMs: Date.now() - startedAt } });
      return output;
    } catch (error) {
      this.logger?.event({ name: "rag.query.failed", status: "failure", traceId: input.traceId, context: { durationMs: Date.now() - startedAt } });
      throw error;
    }
  }
}
