import type { MedicationReview, SafetySignal } from "./clinical-models";

export class ClinicalSafetyEngine {
  prioritize(review: MedicationReview): readonly SafetySignal[] {
    const weight = { HIGH: 3, MODERATE: 2, LOW: 1 } as const;
    return [...review.safety].sort((left, right) => (right.severity ? weight[right.severity] : 0) - (left.severity ? weight[left.severity] : 0));
  }
}
