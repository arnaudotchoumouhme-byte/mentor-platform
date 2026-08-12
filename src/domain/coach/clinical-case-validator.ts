import type { ClinicalCase } from "./clinical-models";

export class ClinicalCaseValidationError extends Error { readonly code = "COACH_CASE_INVALID"; }

export function validateClinicalCase(value: ClinicalCase): ClinicalCase {
  if (!value.patientProfile.synthetic || !value.caseId || value.caseVersion < 1 || !value.learningObjective.trim()) throw new ClinicalCaseValidationError("Cas clinique synthétique invalide.");
  if (value.medications.some((medication) => medication.source !== "SYNTHETIC_CASE" || !medication.medicationName.trim() || medication.dose !== null && medication.dose < 0)) throw new ClinicalCaseValidationError("Médicament synthétique invalide.");
  return value;
}
