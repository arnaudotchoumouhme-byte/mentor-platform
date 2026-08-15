import { FoundationError } from "./foundation-errors";
import {
  isoInstant,
  requiredText,
  stableId,
  type CurriculumStatus,
  type UnitStatus,
} from "./foundation-values";

export type CurriculumVersion = Readonly<{
  id: string;
  programId: string;
  version: number;
  status: CurriculumStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  publishedAt: string | null;
}>;

export type CurriculumBlock = Readonly<{
  id: string;
  curriculumVersionId: string;
  code: string;
  title: string;
  position: number;
  isRequired: boolean;
}>;

export type CurriculumUnit = Readonly<{
  id: string;
  blockId: string;
  code: string;
  title: string;
  description: string;
  estimatedDurationMinutes: number;
  position: number;
  status: UnitStatus;
}>;

export type LearningObjective = Readonly<{
  id: string;
  unitId: string;
  code: string;
  statement: string;
  objectiveType: string;
  position: number;
}>;

export type PrerequisiteRule = Readonly<{
  id: string;
  unitId: string;
  requiredUnitId: string | null;
  requiredObjectiveId: string | null;
  minimumMasteryLevel: import("./foundation-values").MasteryLevel | null;
  createdAt: string;
}>;

const position = (value: number): number => {
  if (!Number.isInteger(value) || value < 0) {
    throw new FoundationError("FOUNDATION_CURRICULUM_INVALID", "Position must be a non-negative integer.", { value });
  }
  return value;
};

export function defineCurriculumVersion(input: CurriculumVersion): CurriculumVersion {
  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new FoundationError("FOUNDATION_CURRICULUM_INVALID", "Curriculum version must be a positive integer.");
  }
  const effectiveFrom = isoInstant(input.effectiveFrom, "effectiveFrom");
  const effectiveTo = input.effectiveTo ? isoInstant(input.effectiveTo, "effectiveTo") : null;
  if (effectiveTo && Date.parse(effectiveTo) <= Date.parse(effectiveFrom)) {
    throw new FoundationError("FOUNDATION_CURRICULUM_INVALID", "Curriculum effective window is invalid.");
  }
  if ((input.status === "DRAFT") === Boolean(input.publishedAt)) {
    throw new FoundationError("FOUNDATION_CURRICULUM_INVALID", "Published status and timestamp must be consistent.");
  }
  return Object.freeze({
    ...input,
    id: stableId(input.id, "id"),
    programId: stableId(input.programId, "programId"),
    effectiveFrom,
    effectiveTo,
    createdAt: isoInstant(input.createdAt, "createdAt"),
    publishedAt: input.publishedAt ? isoInstant(input.publishedAt, "publishedAt") : null,
  });
}

export function publishCurriculumVersion(curriculum: CurriculumVersion, publishedAt: string): CurriculumVersion {
  if (curriculum.status !== "DRAFT") {
    throw new FoundationError("FOUNDATION_CURRICULUM_PUBLISHED", "Only a draft curriculum can be published.");
  }
  return defineCurriculumVersion({ ...curriculum, status: "PUBLISHED", publishedAt });
}

export function defineCurriculumBlock(input: CurriculumBlock): CurriculumBlock {
  return Object.freeze({
    ...input,
    id: stableId(input.id, "id"),
    curriculumVersionId: stableId(input.curriculumVersionId, "curriculumVersionId"),
    code: requiredText(input.code, "code"),
    title: requiredText(input.title, "title"),
    position: position(input.position),
  });
}

export function defineCurriculumUnit(input: CurriculumUnit): CurriculumUnit {
  if (!Number.isInteger(input.estimatedDurationMinutes) || input.estimatedDurationMinutes <= 0) {
    throw new FoundationError("FOUNDATION_CURRICULUM_INVALID", "Estimated duration must be a positive integer.");
  }
  return Object.freeze({
    ...input,
    id: stableId(input.id, "id"),
    blockId: stableId(input.blockId, "blockId"),
    code: requiredText(input.code, "code"),
    title: requiredText(input.title, "title"),
    description: requiredText(input.description, "description"),
    position: position(input.position),
  });
}

export function defineLearningObjective(input: LearningObjective): LearningObjective {
  return Object.freeze({
    ...input,
    id: stableId(input.id, "id"),
    unitId: stableId(input.unitId, "unitId"),
    code: requiredText(input.code, "code"),
    statement: requiredText(input.statement, "statement"),
    objectiveType: requiredText(input.objectiveType, "objectiveType"),
    position: position(input.position),
  });
}

export function definePrerequisiteRule(input: PrerequisiteRule): PrerequisiteRule {
  const unitId = stableId(input.unitId, "unitId");
  const requiredUnitId = input.requiredUnitId ? stableId(input.requiredUnitId, "requiredUnitId") : null;
  const requiredObjectiveId = input.requiredObjectiveId
    ? stableId(input.requiredObjectiveId, "requiredObjectiveId")
    : null;
  if (Boolean(requiredUnitId) === Boolean(requiredObjectiveId) || requiredUnitId === unitId) {
    throw new FoundationError(
      "FOUNDATION_PREREQUISITE_INVALID",
      "A prerequisite must target exactly one different unit or one objective.",
    );
  }
  return Object.freeze({
    ...input,
    id: stableId(input.id, "id"),
    unitId,
    requiredUnitId,
    requiredObjectiveId,
    createdAt: isoInstant(input.createdAt, "createdAt"),
  });
}
