import type {
  FoundationCurriculumRepository,
  FoundationCurriculumSnapshot,
} from "./foundation-ports";
import {
  defineCurriculumBlock,
  defineCurriculumUnit,
  defineCurriculumVersion,
  defineLearningObjective,
} from "@/domain/foundation";

export const INITIAL_FOUNDATION_CURRICULUM_ID = "f0000001-0000-4000-8000-000000000001";
export const INITIAL_FOUNDATION_PROGRAM_ID = "f0000001-0000-4000-8000-000000000002";
export const INITIAL_FOUNDATION_TECHNICAL_EFFECTIVE_FROM = "2027-01-01T00:00:00.000Z";
export const INITIAL_FOUNDATION_TECHNICAL_CREATED_AT = "2026-08-14T00:00:00.000Z";

const BLOCK_DEFINITIONS = [
  ["BIO", "Sciences biomédicales"],
  ["PHA", "Sciences pharmaceutiques"],
  ["CALC", "Calculs pharmaceutiques"],
  ["THER", "Pharmacothérapie"],
  ["CAN", "Pratique canadienne"],
  ["COMM", "Communication clinique bilingue"],
] as const;

const stableSeedId = (kind: "block" | "unit" | "objective", position: number): string => {
  const kindDigit = kind === "block" ? "1" : kind === "unit" ? "2" : "3";
  return `f0000001-0000-4${kindDigit}00-8000-${String(position + 1).padStart(12, "0")}`;
};

export const INITIAL_FOUNDATION_CURRICULUM: FoundationCurriculumSnapshot = (() => {
  const version = defineCurriculumVersion({
    id: INITIAL_FOUNDATION_CURRICULUM_ID,
    programId: INITIAL_FOUNDATION_PROGRAM_ID,
    version: 1,
    status: "DRAFT",
    effectiveFrom: INITIAL_FOUNDATION_TECHNICAL_EFFECTIVE_FROM,
    effectiveTo: null,
    createdAt: INITIAL_FOUNDATION_TECHNICAL_CREATED_AT,
    publishedAt: null,
  });
  const blocks = BLOCK_DEFINITIONS.map(([code, title], position) =>
    defineCurriculumBlock({
      id: stableSeedId("block", position),
      curriculumVersionId: version.id,
      code,
      title,
      position,
      isRequired: true,
    }),
  );
  const units = blocks.map((block, position) =>
    defineCurriculumUnit({
      id: stableSeedId("unit", position),
      blockId: block.id,
      code: `${block.code}-TECH-01`,
      title: `Structure technique ${block.code}`,
      description: "Élément de démonstration technique non clinique et non publié.",
      estimatedDurationMinutes: 15,
      position: 0,
      status: "DRAFT",
    }),
  );
  const objectives = units.map((unit, position) =>
    defineLearningObjective({
      id: stableSeedId("objective", position),
      unitId: unit.id,
      code: `${BLOCK_DEFINITIONS[position]![0]}-TECH-OBJ-01`,
      statement: "Identifier la structure technique de démonstration de ce bloc.",
      objectiveType: "TECHNICAL_SEED",
      position: 0,
    }),
  );
  return Object.freeze({
    version,
    blocks: Object.freeze(blocks),
    units: Object.freeze(units),
    objectives: Object.freeze(objectives),
    prerequisites: Object.freeze([]),
  });
})();

export type FoundationCurriculumSeedResult = Readonly<{
  status: "CREATED" | "ALREADY_PRESENT";
  curriculum: FoundationCurriculumSnapshot;
}>;

export async function seedInitialFoundationCurriculum(
  repository: FoundationCurriculumRepository,
): Promise<FoundationCurriculumSeedResult> {
  const existing = await repository.findVersion(INITIAL_FOUNDATION_CURRICULUM_ID);
  if (existing) return Object.freeze({ status: "ALREADY_PRESENT", curriculum: existing });
  await repository.save(INITIAL_FOUNDATION_CURRICULUM);
  return Object.freeze({ status: "CREATED", curriculum: INITIAL_FOUNDATION_CURRICULUM });
}
