import { FoundationError } from "./foundation-errors";

export type CurriculumStatus = "DRAFT" | "PUBLISHED" | "RETIRED";
export type UnitStatus = "DRAFT" | "ACTIVE" | "RETIRED";
export type DiagnosticStatus = "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type MasteryLevel = "N0" | "N1" | "N2" | "N3" | "N4";
export type RecommendationDecision = "REQUIRED" | "RECOMMENDED" | "EXEMPTED";
export type CriticalErrorCategory =
  | "SAFETY"
  | "CALCULATION"
  | "PHARMACOTHERAPY"
  | "CANADIAN_PRACTICE";
export type PedagogicalDecision =
  | "CONTINUE_FOUNDATION"
  | "READY_FOR_MCQ"
  | "READY_FOR_TRANSFER"
  | "RETEST_REQUIRED";
export type FoundationUnitStage =
  | "PRE_TEST"
  | "MICRO_LESSON"
  | "GUIDED_PRACTICE"
  | "APPLICATION"
  | "TEACH_BACK"
  | "EXIT_ASSESSMENT"
  | "CONSOLIDATION"
  | "RETEST";
export type FoundationUnitProgressStatus = "IN_PROGRESS" | "COMPLETED";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function stableId(value: string, field: string): string {
  const normalized = value.trim();
  if (!uuidPattern.test(normalized)) {
    throw new FoundationError("FOUNDATION_ID_INVALID", `${field} must be a stable UUID.`, { field });
  }
  return normalized;
}

export function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new FoundationError("FOUNDATION_CURRICULUM_INVALID", `${field} must not be blank.`, { field });
  }
  return normalized;
}

export function isoInstant(value: string, field: string): string {
  const timestamp = Date.parse(value);
  if (!value.trim() || Number.isNaN(timestamp)) {
    throw new FoundationError("FOUNDATION_CURRICULUM_INVALID", `${field} must be an ISO timestamp.`, { field });
  }
  return value;
}

export function confidence(value: number, field = "confidence"): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new FoundationError("FOUNDATION_OBSERVATION_INVALID", `${field} must be between zero and one.`, { field, value });
  }
  return value;
}

export function frozenIds(values: readonly string[], field: string, allowEmpty = false): readonly string[] {
  const normalized = [...new Set(values.map((value) => stableId(value, field)))];
  if (!allowEmpty && normalized.length === 0) {
    throw new FoundationError("FOUNDATION_DIAGNOSTIC_INVALID", `${field} must not be empty.`, { field });
  }
  return Object.freeze(normalized);
}
