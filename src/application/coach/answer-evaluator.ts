import type { ClinicalErrorType, SafetySignal } from "@/domain/coach/clinical-models";

const concepts = (text: string) => new Set(text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []);
export class AnswerEvaluator {
  evaluate(answer: string, expectedFindings: readonly string[], safetySignals: readonly SafetySignal[]) {
    const answerConcepts = concepts(answer); const expected = new Set(expectedFindings.flatMap((item) => [...concepts(item)]));
    const matched = [...expected].filter((item) => answerConcepts.has(item)).length;
    const missedSafety = safetySignals.length > 0 && !safetySignals.some(({ relatedMedications, signalType }) => [...relatedMedications, signalType].some((item) => [...concepts(item)].some((word) => answerConcepts.has(word))));
    const score = expected.size ? matched / expected.size : Number(answer.trim().length >= 20);
    const errorType: ClinicalErrorType | null = missedSafety ? "ERR_SAFE" : score < 0.3 ? "ERR_KNOW" : score < 0.65 ? "ERR_CLIN" : null;
    return { result: score >= 0.65 && !missedSafety ? "PASS" as const : score >= 0.3 ? "PARTIAL" as const : "FAIL" as const, score, errorType, missedSafety, remediation: missedSafety ? "SAFETY_CHECKLIST → SENTINEL_CASE → PRIORITY_RETEST" : errorType === "ERR_CLIN" ? "Cas guidé puis transfert." : errorType ? "Micro-leçon puis re-test." : null };
  }
  evaluateTeachBack(answer: string, criteria: readonly string[]) { const covered = criteria.filter((criterion) => [...concepts(criterion)].some((word) => concepts(answer).has(word))).length; return { result: covered >= Math.max(1, Math.ceil(criteria.length * 0.6)) ? "PASS" as const : "NEEDS_REINFORCEMENT" as const, covered, total: criteria.length }; }
}
