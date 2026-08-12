import type { ClinicalCase } from "@/domain/coach/clinical-models";
import type { CoachIdentityPort } from "./coach-ports";

export class TransferCaseGenerator {
  constructor(private readonly identity: CoachIdentityPort) {}
  generate(source: ClinicalCase): ClinicalCase { return { ...source, caseId: this.identity.id(), caseVersion: 1, title: `${source.title} — transfert`, clinicalContext: `Contexte de transfert différent : ${source.clinicalContext}`, patientProfile: { ...source.patientProfile, age: source.patientProfile.age ? source.patientProfile.age + 7 : 55 }, provenance: "SYNTHETIC_GENERATED" }; }
}
