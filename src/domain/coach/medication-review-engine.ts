import type { ClinicalCase, MedicationReview, SafetySignal } from "./clinical-models";

export type ClinicalEvidenceRule = Readonly<{ ruleId: string; kind: "INTERACTION" | "CONTRAINDICATION" | "DOSE" | "MONITORING" | "CLASS_DUPLICATION"; agents: readonly string[]; patientCondition?: string; requiredData?: readonly string[]; description: string; evidenceRefs: readonly string[]; severity?: SafetySignal["severity"] }>;
const normalized = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const signal = (type: SafetySignal["signalType"], description: string, medications: readonly string[], evidenceRefs: readonly string[], status: SafetySignal["status"] = "CONFIRMED", requiredData: readonly string[] = [], severity: SafetySignal["severity"] = null): SafetySignal => ({ signalId: `${type}-${medications.map(normalized).join("-")}`, signalType: type, severity, description, relatedMedications: medications, requiredData, evidenceRefs, confidence: evidenceRefs.length ? 1 : 0.8, status });

export class MedicationReviewEngine {
  review(clinicalCase: ClinicalCase, rules: readonly ClinicalEvidenceRule[]): MedicationReview {
    const medications = clinicalCase.medications.filter(({ status }) => status === "ACTIVE");
    const safety: SafetySignal[] = [];
    for (const reaction of clinicalCase.patientProfile.allergies) {
      const exposed = medications.filter(({ activeIngredient }) => normalized(activeIngredient) === normalized(reaction.substance));
      if (exposed.length) safety.push(signal("ALLERGY_SIGNAL", reaction.description ?? `${reaction.type} documentée dans le cas synthétique.`, exposed.map(({ medicationName }) => medicationName), [], reaction.type === "UNKNOWN_REACTION" ? "NEEDS_VERIFICATION" : "CONFIRMED", reaction.type === "UNKNOWN_REACTION" ? ["reaction_type"] : [], reaction.type === "ALLERGY" ? "HIGH" : null));
    }
    const ingredientGroups = Map.groupBy(medications, ({ activeIngredient }) => normalized(activeIngredient));
    for (const group of ingredientGroups.values()) if (group.length > 1) safety.push(signal("DUPLICATION_SIGNAL", "Duplication de substance à vérifier; elle peut être intentionnelle.", group.map(({ medicationName }) => medicationName), [], "NEEDS_VERIFICATION"));
    for (const rule of rules) {
      const matched = medications.filter(({ activeIngredient }) => rule.agents.some((agent) => normalized(agent) === normalized(activeIngredient)));
      if (rule.kind === "INTERACTION" && rule.agents.every((agent) => medications.some(({ activeIngredient }) => normalized(agent) === normalized(activeIngredient)))) safety.push(signal("INTERACTION_SIGNAL", rule.description, matched.map(({ medicationName }) => medicationName), rule.evidenceRefs, "CONFIRMED", [], rule.severity));
      if (rule.kind === "CONTRAINDICATION" && matched.length && rule.patientCondition && clinicalCase.patientProfile.diagnoses.some((item) => normalized(item) === normalized(rule.patientCondition!))) safety.push(signal("CONTRAINDICATION_SIGNAL", rule.description, matched.map(({ medicationName }) => medicationName), rule.evidenceRefs, "CONFIRMED", [], rule.severity));
      if ((rule.kind === "DOSE" || rule.kind === "MONITORING") && matched.length) {
        const missing = (rule.requiredData ?? []).filter((key) => !(key in clinicalCase.patientProfile.laboratoryValues) && key !== "renalFunction" && key !== "hepaticFunction" || key === "renalFunction" && !clinicalCase.patientProfile.renalFunction || key === "hepaticFunction" && !clinicalCase.patientProfile.hepaticFunction);
        if (missing.length) safety.push(signal(rule.kind === "DOSE" ? "MISSING_DATA_SIGNAL" : "MONITORING_SIGNAL", rule.description, matched.map(({ medicationName }) => medicationName), rule.evidenceRefs, "NEEDS_VERIFICATION", missing));
      }
    }
    const doseAssessments = medications.map((medication) => {
      const doseRule = rules.find((rule) => rule.kind === "DOSE" && rule.agents.some((agent) => normalized(agent) === normalized(medication.activeIngredient)));
      if (!doseRule) return { medication: medication.medicationName, status: "NO_EVIDENCE" as const, rationale: "Aucune règle posologique documentaire disponible.", requiredData: [], evidenceRefs: [] };
      const missingSignal = safety.find(({ signalType, relatedMedications }) => signalType === "MISSING_DATA_SIGNAL" && relatedMedications.includes(medication.medicationName));
      return missingSignal ? { medication: medication.medicationName, status: "INSUFFICIENT_DATA" as const, rationale: "Donnée clinique requise absente; aucune précision posologique ne peut être fournie.", requiredData: missingSignal.requiredData, evidenceRefs: doseRule.evidenceRefs } : { medication: medication.medicationName, status: "ADJUSTMENT_MAY_BE_REQUIRED" as const, rationale: doseRule.description, requiredData: [], evidenceRefs: doseRule.evidenceRefs };
    });
    return { indication: medications.filter(({ indication }) => !indication).map(({ medicationName }) => `Indication à clarifier pour ${medicationName}.`), effectiveness: [], safety, adherence: clinicalCase.patientProfile.adherence ? [] : ["Adhésion et utilisation à vérifier."], monitoring: safety.filter(({ signalType }) => signalType === "MONITORING_SIGNAL").map(({ description }) => description), doseAssessments };
  }
}
