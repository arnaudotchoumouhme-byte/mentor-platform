import type { ClinicalCase } from "@/domain/coach/clinical-models";

const medication = (name: string, ingredient = name): ClinicalCase["medications"][number] => ({
  medicationName: name, activeIngredient: ingredient, dose: 5, doseUnit: "mg", route: "orale",
  frequency: "1 fois/jour", indication: "Cas éducatif", status: "ACTIVE", source: "SYNTHETIC_CASE",
});

export const SYNTHETIC_SAFETY_CASE: ClinicalCase = {
  caseId: "case-safety-1", caseVersion: 1, title: "Revue médicamenteuse synthétique",
  learningObjective: "Identifier les risques avant de proposer une décision", difficulty: "INTERMEDIATE", language: "fr",
  patientProfile: { synthetic: true, age: 72,
    allergies: [{ substance: "amoxicilline", type: "ALLERGY", description: "Urticaire documentée dans le scénario." }],
    diagnoses: ["insuffisance rénale"], symptoms: [], medications: [], otc: [], naturalHealthProducts: [],
    vitalSigns: {}, laboratoryValues: {}, socialFactors: [], previousMedicationReactions: [], treatmentGoals: ["Sécurité"] },
  medications: [medication("Amoxicilline", "amoxicilline"), medication("Warfarine", "warfarine"), medication("Warfarine générique", "warfarine")],
  clinicalContext: "Patient entièrement fictif présenté pour un exercice éducatif.",
  expectedFindings: ["allergie", "duplication", "fonction rénale", "monitoring"],
  expectedSafetySignals: ["ALLERGY_SIGNAL", "DUPLICATION_SIGNAL", "MISSING_DATA_SIGNAL"],
  evidenceRequirements: ["DOSE:amoxicilline:renalFunction", "MONITORING:warfarine:INR"],
  blueprintTags: ["Providing Care"], competencyTags: ["Medication management"], provenance: "SYNTHETIC_FIXTURE",
};
