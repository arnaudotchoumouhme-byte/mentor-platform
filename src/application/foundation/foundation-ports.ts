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
  MasteryLevel,
  MasteryEstimate,
  PedagogicalDecision,
  PrerequisiteRule,
  RecommendationDecision,
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
  findActiveUnitProgress(learnerId: string, curriculumVersionId: string, unitId: string): Promise<FoundationUnitProgress | null>;
}

export type FoundationEvidenceReference = Pick<
  DiagnosticObservation,
  "evidenceType" | "evidenceRefId" | "evidenceRefVersion"
>;

export interface FoundationIdGenerator { next(): string; }
export interface FoundationClock { now(): string; }

export type FoundationPolicyScope = Readonly<{
  learnerId: string;
  curriculumVersionId: string;
  blockId: string;
  unitId: string | null;
  objectiveId: string | null;
  observations: readonly DiagnosticObservation[];
}>;

export interface FoundationDiagnosticPolicy {
  readonly ruleVersion: string;
  estimate(scope: FoundationPolicyScope): Readonly<{ level: MasteryLevel; confidence: number }>;
  recommend(
    scope: FoundationPolicyScope & Readonly<{ mastery: MasteryEstimate }>,
  ): Readonly<{ decision: RecommendationDecision; justification: string }>;
}

export interface FoundationProgressPolicy {
  readonly ruleVersion: string;
  decideExit(observations: readonly DiagnosticObservation[]): PedagogicalDecision;
  isRetestSatisfactory(observation: DiagnosticObservation): boolean;
}
