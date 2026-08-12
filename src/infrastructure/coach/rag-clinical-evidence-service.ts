import "server-only";
import type { ClinicalEvidenceService } from "@/application/coach/coach-ports";
import type { ClinicalEvidenceRule } from "@/domain/coach/medication-review-engine";
import type { CitationBuilder, EvidenceGate, Retriever } from "@/application/rag/rag-ports";

export class RagClinicalEvidenceService implements ClinicalEvidenceService {
  constructor(private readonly retriever: Retriever, private readonly gate: EvidenceGate, private readonly citations: CitationBuilder, private readonly indexedCount: () => number) {}
  loadRules(requirements: readonly string[]) {
    const rules: ClinicalEvidenceRule[] = []; const evidenceRefs: string[] = [];
    for (const requirement of requirements) {
      const decision = this.gate.evaluate(requirement, this.retriever.retrieve(requirement), this.indexedCount()); if (decision.status !== "SUFFICIENT") continue; const citations = this.citations.build(decision.evidence); evidenceRefs.push(...citations.map(({ citationId }) => citationId));
      const [kindRaw, agentsRaw = "", requiredRaw = ""] = requirement.split(":"); const kind = kindRaw.toUpperCase(); if (!["INTERACTION","CONTRAINDICATION","DOSE","MONITORING","CLASS_DUPLICATION"].includes(kind)) continue;
      rules.push({ ruleId: `rule-${rules.length + 1}`, kind: kind as ClinicalEvidenceRule["kind"], agents: agentsRaw.split("|").filter(Boolean), requiredData: requiredRaw.split("|").filter(Boolean), description: citations[0]?.excerpt ?? requirement, evidenceRefs: citations.map(({ citationId }) => citationId) });
    }
    return { status: rules.length ? "SUFFICIENT" as const : "INSUFFICIENT" as const, rules, evidenceRefs: [...new Set(evidenceRefs)], conflicts: [] };
  }
}
