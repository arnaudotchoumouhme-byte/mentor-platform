import { McqError } from "./mcq-errors";

export type BlueprintMapping = Readonly<{
  blueprintVersionId: string;
  domainId: string;
  competencyId: string;
  topicId: string;
  objectiveIds: readonly string[];
}>;

const nonBlank = (value: string): boolean => value.trim().length > 0;

export function defineBlueprintMapping(input: BlueprintMapping): BlueprintMapping {
  const objectiveIds = [...new Set(input.objectiveIds.map((id) => id.trim()))];
  if (![input.blueprintVersionId, input.domainId, input.competencyId, input.topicId].every(nonBlank) || objectiveIds.length === 0 || objectiveIds.some((id) => !id)) {
    throw new McqError("MCQ_ITEM_INVALID", "Mapping pédagogique invalide.", "Every MCQ mapping reference is required.");
  }
  return Object.freeze({
    blueprintVersionId: input.blueprintVersionId.trim(), domainId: input.domainId.trim(),
    competencyId: input.competencyId.trim(), topicId: input.topicId.trim(),
    objectiveIds: Object.freeze(objectiveIds),
  });
}
