import { FoundationError } from "./foundation-errors";
import {
  confidence,
  frozenIds,
  isoInstant,
  requiredText,
  stableId,
  type CriticalErrorCategory,
  type MasteryLevel,
  type PedagogicalDecision,
  type RecommendationDecision,
} from "./foundation-values";

type FoundationScope = Readonly<{
  learnerId: string;
  curriculumVersionId: string;
  blockId: string;
  unitId: string | null;
  objectiveId: string | null;
}>;

export type MasteryEstimate = FoundationScope & Readonly<{
  id: string;
  level: MasteryLevel;
  confidence: number;
  calculatedAt: string;
  evidenceObservationIds: readonly string[];
  ruleVersion: string;
}>;

export type FoundationRecommendation = Omit<FoundationScope, "objectiveId"> & Readonly<{
  id: string;
  decision: RecommendationDecision;
  justification: string;
  evidenceObservationIds: readonly string[];
  ruleVersion: string;
  decidedAt: string;
  supersedesId: string | null;
}>;

export type ExitAssessmentStatus = "IN_PROGRESS" | "COMPLETED";
export type ExitAssessment = Readonly<{
  id: string;
  learnerId: string;
  curriculumVersionId: string;
  unitId: string;
  status: ExitAssessmentStatus;
  startedAt: string;
  completedAt: string | null;
  observationIds: readonly string[];
  result: Readonly<Record<string, unknown>> | null;
  criticalErrorCategories: readonly CriticalErrorCategory[];
  pedagogicalDecision: PedagogicalDecision | null;
  ruleVersion: string;
}>;

const defineScope = <T extends FoundationScope>(input: T): T => ({
  ...input,
  learnerId: stableId(input.learnerId, "learnerId"),
  curriculumVersionId: stableId(input.curriculumVersionId, "curriculumVersionId"),
  blockId: stableId(input.blockId, "blockId"),
  unitId: input.unitId ? stableId(input.unitId, "unitId") : null,
  objectiveId: input.objectiveId ? stableId(input.objectiveId, "objectiveId") : null,
});

export function defineMasteryEstimate(input: MasteryEstimate): MasteryEstimate {
  const evidenceObservationIds = frozenIds(
    input.evidenceObservationIds,
    "evidenceObservationIds",
    true,
  );
  if (input.level !== "N0" && evidenceObservationIds.length === 0) {
    throw new FoundationError("FOUNDATION_MASTERY_INVALID", "Observed mastery requires evidence.");
  }
  return Object.freeze({
    ...defineScope(input),
    id: stableId(input.id, "id"),
    confidence: confidence(input.confidence),
    calculatedAt: isoInstant(input.calculatedAt, "calculatedAt"),
    evidenceObservationIds,
    ruleVersion: requiredText(input.ruleVersion, "ruleVersion"),
  });
}

export function defineFoundationRecommendation(
  input: FoundationRecommendation,
): FoundationRecommendation {
  const scoped = defineScope({ ...input, objectiveId: null });
  return Object.freeze({
    ...input,
    learnerId: scoped.learnerId,
    curriculumVersionId: scoped.curriculumVersionId,
    blockId: scoped.blockId,
    unitId: scoped.unitId,
    id: stableId(input.id, "id"),
    justification: requiredText(input.justification, "justification"),
    evidenceObservationIds: frozenIds(input.evidenceObservationIds, "evidenceObservationIds"),
    ruleVersion: requiredText(input.ruleVersion, "ruleVersion"),
    decidedAt: isoInstant(input.decidedAt, "decidedAt"),
    supersedesId: input.supersedesId ? stableId(input.supersedesId, "supersedesId") : null,
  });
}

export function createExitAssessment(
  input: Pick<ExitAssessment, "id" | "learnerId" | "curriculumVersionId" | "unitId" | "startedAt" | "ruleVersion">,
): ExitAssessment {
  return Object.freeze({
    ...input,
    id: stableId(input.id, "id"),
    learnerId: stableId(input.learnerId, "learnerId"),
    curriculumVersionId: stableId(input.curriculumVersionId, "curriculumVersionId"),
    unitId: stableId(input.unitId, "unitId"),
    startedAt: isoInstant(input.startedAt, "startedAt"),
    ruleVersion: requiredText(input.ruleVersion, "ruleVersion"),
    status: "IN_PROGRESS",
    completedAt: null,
    observationIds: Object.freeze([]),
    result: null,
    criticalErrorCategories: Object.freeze([]),
    pedagogicalDecision: null,
  });
}

export function completeExitAssessment(
  assessment: ExitAssessment,
  input: Readonly<{
    completedAt: string;
    observationIds: readonly string[];
    result: Readonly<Record<string, unknown>>;
    unresolvedCriticalErrors: readonly CriticalErrorCategory[];
    decision: PedagogicalDecision;
  }>,
): ExitAssessment {
  if (assessment.status !== "IN_PROGRESS") {
    throw new FoundationError("FOUNDATION_EXIT_ASSESSMENT_INVALID", "Exit assessment is already closed.");
  }
  const completedAt = isoInstant(input.completedAt, "completedAt");
  if (Date.parse(completedAt) < Date.parse(assessment.startedAt)) {
    throw new FoundationError("FOUNDATION_EXIT_ASSESSMENT_INVALID", "Exit assessment completion predates start.");
  }
  const criticalErrors = Object.freeze([...new Set(input.unresolvedCriticalErrors)]);
  return Object.freeze({
    ...assessment,
    status: "COMPLETED",
    completedAt,
    observationIds: frozenIds(input.observationIds, "observationIds"),
    result: Object.freeze({ ...input.result }),
    criticalErrorCategories: criticalErrors,
    pedagogicalDecision: criticalErrors.length > 0 ? "RETEST_REQUIRED" : input.decision,
  });
}
