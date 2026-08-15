import { FoundationError } from "./foundation-errors";
import {
  isoInstant,
  stableId,
  type FoundationUnitProgressStatus,
  type FoundationUnitStage,
} from "./foundation-values";

export type FoundationUnitProgress = Readonly<{
  id: string;
  learnerId: string;
  curriculumVersionId: string;
  unitId: string;
  currentStage: FoundationUnitStage;
  status: FoundationUnitProgressStatus;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}>;

export const FOUNDATION_UNIT_STAGES: readonly FoundationUnitStage[] = Object.freeze([
  "PRE_TEST",
  "MICRO_LESSON",
  "GUIDED_PRACTICE",
  "APPLICATION",
  "TEACH_BACK",
  "EXIT_ASSESSMENT",
  "CONSOLIDATION",
  "RETEST",
]);

export function createFoundationUnitProgress(
  input: Pick<FoundationUnitProgress, "id" | "learnerId" | "curriculumVersionId" | "unitId" | "startedAt">,
): FoundationUnitProgress {
  const startedAt = isoInstant(input.startedAt, "startedAt");
  return Object.freeze({
    ...input,
    id: stableId(input.id, "id"),
    learnerId: stableId(input.learnerId, "learnerId"),
    curriculumVersionId: stableId(input.curriculumVersionId, "curriculumVersionId"),
    unitId: stableId(input.unitId, "unitId"),
    currentStage: "PRE_TEST",
    status: "IN_PROGRESS",
    startedAt,
    updatedAt: startedAt,
    completedAt: null,
  });
}

export function advanceFoundationUnitProgress(
  progress: FoundationUnitProgress,
  targetStage: FoundationUnitStage,
  updatedAt: string,
): FoundationUnitProgress {
  if (progress.status !== "IN_PROGRESS") {
    throw new FoundationError("FOUNDATION_PROGRESS_INVALID_TRANSITION", "Completed progress cannot advance.");
  }
  if (targetStage === progress.currentStage) return progress;
  const currentIndex = FOUNDATION_UNIT_STAGES.indexOf(progress.currentStage);
  if (FOUNDATION_UNIT_STAGES[currentIndex + 1] !== targetStage) {
    throw new FoundationError("FOUNDATION_PROGRESS_INVALID_TRANSITION", "Unit stages must advance one step at a time.");
  }
  const timestamp = isoInstant(updatedAt, "updatedAt");
  if (Date.parse(timestamp) < Date.parse(progress.updatedAt)) {
    throw new FoundationError("FOUNDATION_PROGRESS_INVALID_TRANSITION", "Progress timestamps must be monotone.");
  }
  return Object.freeze({ ...progress, currentStage: targetStage, updatedAt: timestamp });
}

export function completeFoundationUnitProgress(
  progress: FoundationUnitProgress,
  completedAt: string,
): FoundationUnitProgress {
  if (progress.status !== "IN_PROGRESS" || progress.currentStage !== "RETEST") {
    throw new FoundationError("FOUNDATION_PROGRESS_INVALID_TRANSITION", "Progress completes only after re-test.");
  }
  const timestamp = isoInstant(completedAt, "completedAt");
  if (Date.parse(timestamp) < Date.parse(progress.updatedAt)) {
    throw new FoundationError("FOUNDATION_PROGRESS_INVALID_TRANSITION", "Completion timestamp must be monotone.");
  }
  return Object.freeze({ ...progress, status: "COMPLETED", updatedAt: timestamp, completedAt: timestamp });
}
