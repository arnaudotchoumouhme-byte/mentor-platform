import type {
  CurriculumBlock,
  CurriculumUnit,
  CurriculumVersion,
  DiagnosticObservation,
  ExitAssessment,
  FoundationDiagnostic,
  FoundationRecommendation,
  FoundationUnitProgress,
  LearningObjective,
  MasteryEstimate,
  PrerequisiteRule,
} from "@/domain/foundation";

export type FoundationCurriculumSnapshot = Readonly<{
  version: CurriculumVersion;
  blocks: readonly CurriculumBlock[];
  units: readonly CurriculumUnit[];
  objectives: readonly LearningObjective[];
  prerequisites: readonly PrerequisiteRule[];
}>;

export interface FoundationCurriculumRepository {
  save(snapshot: FoundationCurriculumSnapshot): Promise<void>;
  findVersion(curriculumVersionId: string): Promise<FoundationCurriculumSnapshot | null>;
}

export interface FoundationLearningRepository {
  saveDiagnostic(diagnostic: FoundationDiagnostic): Promise<void>;
  findDiagnostic(diagnosticId: string): Promise<FoundationDiagnostic | null>;
  appendMasteryEstimate(estimate: MasteryEstimate): Promise<void>;
  listMasteryEstimates(learnerId: string): Promise<readonly MasteryEstimate[]>;
  appendRecommendation(recommendation: FoundationRecommendation): Promise<void>;
  listRecommendations(learnerId: string): Promise<readonly FoundationRecommendation[]>;
  saveExitAssessment(assessment: ExitAssessment): Promise<void>;
  findExitAssessment(exitAssessmentId: string): Promise<ExitAssessment | null>;
  saveUnitProgress(progress: FoundationUnitProgress): Promise<void>;
  findUnitProgress(unitProgressId: string): Promise<FoundationUnitProgress | null>;
}

export type FoundationEvidenceReference = Pick<
  DiagnosticObservation,
  "evidenceType" | "evidenceRefId" | "evidenceRefVersion"
>;
