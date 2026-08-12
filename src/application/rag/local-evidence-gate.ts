import type { EvidenceDecision, RetrievalCandidate } from "@/domain/rag/evidence";
import type { EvidenceGate } from "./rag-ports";

export const EVIDENCE_THRESHOLD = 0.38;
const stopWords = new Set(["quelle", "quelles", "entre", "difference", "expliquer", "explique", "comment", "pourquoi", "dans", "avec"]);
const words = (text: string) => new Set((text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter((word) => !stopWords.has(word)));

export class LocalEvidenceGate implements EvidenceGate {
  evaluate(query: string, candidates: readonly RetrievalCandidate[], indexedCount: number): EvidenceDecision {
    if (indexedCount === 0) return { status: "NONE", reason: "NO_INDEXED_DOCUMENTS", evidence: [] };
    if (candidates.length === 0) return { status: "NONE", reason: "NO_CANDIDATES", evidence: [] };
    const retained = candidates.filter(({ score }) => score >= EVIDENCE_THRESHOLD);
    const queryWords = words(query);
    const evidenceWords = words(retained.map(({ chunk }) => chunk.text).join(" "));
    const coverage = queryWords.size ? [...queryWords].filter((word) => evidenceWords.has(word)).length / queryWords.size : 0;
    if (!retained.length || coverage < 0.5) return { status: "INSUFFICIENT", reason: "BELOW_THRESHOLD", evidence: [] };
    return { status: "SUFFICIENT", reason: "EVIDENCE_FOUND", evidence: retained };
  }
}
