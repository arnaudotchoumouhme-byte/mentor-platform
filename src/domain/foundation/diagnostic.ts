import { FoundationError } from "./foundation-errors";
import {
  confidence,
  frozenIds,
  isoInstant,
  requiredText,
  stableId,
  type CriticalErrorCategory,
  type DiagnosticStatus,
} from "./foundation-values";

export type ObservationEvidenceType = "FOUNDATION" | "MCQ" | "COACH" | "SOURCE_VERSION" | "EXTERNAL";

export type DiagnosticObservation = Readonly<{
  id: string;
  diagnosticId: string;
  learnerId: string;
  curriculumVersionId: string;
  blockId: string;
  unitId: string | null;
  objectiveId: string | null;
  activityType: string;
  outcome: Readonly<Record<string, unknown>>;
  confidence: number | null;
  durationMs: number | null;
  criticalErrorCategory: CriticalErrorCategory | null;
  evidenceType: ObservationEvidenceType;
  evidenceRefId: string | null;
  evidenceRefVersion: string | null;
  observedAt: string;
}>;

export type FoundationDiagnostic = Readonly<{
  id: string;
  learnerId: string;
  curriculumVersionId: string;
  status: DiagnosticStatus;
  targetBlockIds: readonly string[];
  startedAt: string;
  completedAt: string | null;
  observedCount: number;
  expectedCount: number | null;
  observations: readonly DiagnosticObservation[];
}>;

export function defineDiagnosticObservation(input: DiagnosticObservation): DiagnosticObservation {
  const evidenceRefId = input.evidenceRefId?.trim() || null;
  const evidenceRefVersion = input.evidenceRefVersion?.trim() || null;
  if (Boolean(evidenceRefId) !== Boolean(evidenceRefVersion)) {
    throw new FoundationError(
      "FOUNDATION_OBSERVATION_INVALID",
      "External evidence ID and version must be provided together.",
    );
  }
  if (input.durationMs !== null && (!Number.isInteger(input.durationMs) || input.durationMs < 0)) {
    throw new FoundationError("FOUNDATION_OBSERVATION_INVALID", "Observation duration must be non-negative.");
  }
  return Object.freeze({
    ...input,
    id: stableId(input.id, "id"),
    diagnosticId: stableId(input.diagnosticId, "diagnosticId"),
    learnerId: stableId(input.learnerId, "learnerId"),
    curriculumVersionId: stableId(input.curriculumVersionId, "curriculumVersionId"),
    blockId: stableId(input.blockId, "blockId"),
    unitId: input.unitId ? stableId(input.unitId, "unitId") : null,
    objectiveId: input.objectiveId ? stableId(input.objectiveId, "objectiveId") : null,
    activityType: requiredText(input.activityType, "activityType"),
    outcome: Object.freeze({ ...input.outcome }),
    confidence: input.confidence === null ? null : confidence(input.confidence),
    evidenceRefId,
    evidenceRefVersion,
    observedAt: isoInstant(input.observedAt, "observedAt"),
  });
}

export function createFoundationDiagnostic(
  input: Omit<FoundationDiagnostic, "status" | "completedAt" | "observedCount" | "observations">,
): FoundationDiagnostic {
  if (input.expectedCount !== null && (!Number.isInteger(input.expectedCount) || input.expectedCount < 1)) {
    throw new FoundationError("FOUNDATION_DIAGNOSTIC_INVALID", "Expected count must be positive when provided.");
  }
  return Object.freeze({
    ...input,
    id: stableId(input.id, "id"),
    learnerId: stableId(input.learnerId, "learnerId"),
    curriculumVersionId: stableId(input.curriculumVersionId, "curriculumVersionId"),
    targetBlockIds: frozenIds(input.targetBlockIds, "targetBlockIds"),
    startedAt: isoInstant(input.startedAt, "startedAt"),
    status: "IN_PROGRESS",
    completedAt: null,
    observedCount: 0,
    observations: Object.freeze([]),
  });
}

export function recordDiagnosticObservation(
  diagnostic: FoundationDiagnostic,
  candidate: DiagnosticObservation,
): FoundationDiagnostic {
  if (diagnostic.status !== "IN_PROGRESS") {
    throw new FoundationError("FOUNDATION_DIAGNOSTIC_CLOSED", "A closed diagnostic cannot accept observations.");
  }
  const observation = defineDiagnosticObservation(candidate);
  if (
    observation.diagnosticId !== diagnostic.id ||
    observation.learnerId !== diagnostic.learnerId ||
    observation.curriculumVersionId !== diagnostic.curriculumVersionId ||
    !diagnostic.targetBlockIds.includes(observation.blockId) ||
    diagnostic.observations.some(({ id }) => id === observation.id)
  ) {
    throw new FoundationError("FOUNDATION_OBSERVATION_INVALID", "Observation is inconsistent with its diagnostic.");
  }
  const observedCount = diagnostic.observedCount + 1;
  if (diagnostic.expectedCount !== null && observedCount > diagnostic.expectedCount) {
    throw new FoundationError("FOUNDATION_DIAGNOSTIC_INVALID", "Diagnostic progress cannot exceed its expected count.");
  }
  return Object.freeze({
    ...diagnostic,
    observedCount,
    observations: Object.freeze([...diagnostic.observations, observation]),
  });
}

export function completeFoundationDiagnostic(
  diagnostic: FoundationDiagnostic,
  completedAt: string,
): FoundationDiagnostic {
  if (diagnostic.status !== "IN_PROGRESS" || diagnostic.observedCount === 0) {
    throw new FoundationError("FOUNDATION_DIAGNOSTIC_INVALID", "Only an observed diagnostic can be completed.");
  }
  if (diagnostic.expectedCount !== null && diagnostic.observedCount !== diagnostic.expectedCount) {
    throw new FoundationError("FOUNDATION_DIAGNOSTIC_INVALID", "Diagnostic completion requires expected progress.");
  }
  const completion = isoInstant(completedAt, "completedAt");
  if (Date.parse(completion) < Date.parse(diagnostic.startedAt)) {
    throw new FoundationError("FOUNDATION_DIAGNOSTIC_INVALID", "Diagnostic completion cannot predate its start.");
  }
  return Object.freeze({ ...diagnostic, status: "COMPLETED", completedAt: completion });
}
