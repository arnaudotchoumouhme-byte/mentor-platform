import { defineBlueprintMapping, type BlueprintMapping } from "./blueprint-mapping";
import { McqError } from "./mcq-errors";

export type QuestionDifficulty = "FOUNDATION" | "INTERMEDIATE" | "ADVANCED";
export type QuestionChoice = Readonly<{ id: string; text: string }>;
export type QuestionItemVersion = Readonly<{
  itemId: string; version: number; stem: string; choices: readonly QuestionChoice[];
  correctChoiceId: string; explanation: string; difficulty: QuestionDifficulty;
  provenance: string | null; mappings: readonly BlueprintMapping[];
}>;

export function defineQuestionItemVersion(input: QuestionItemVersion): QuestionItemVersion {
  const choices = input.choices.map(({ id, text }) => Object.freeze({ id: id.trim(), text: text.trim() }));
  const ids = choices.map(({ id }) => id);
  if (!input.itemId.trim() || !Number.isInteger(input.version) || input.version < 1 || !input.stem.trim() || !input.explanation.trim() || choices.length < 2 || ids.some((id) => !id) || choices.some(({ text }) => !text) || new Set(ids).size !== ids.length || !ids.includes(input.correctChoiceId) || input.mappings.length === 0) {
    throw new McqError("MCQ_ITEM_INVALID", "Question MCQ invalide.", "Question item invariants are not satisfied.", { itemId: input.itemId, version: input.version });
  }
  return Object.freeze({ ...input, itemId: input.itemId.trim(), stem: input.stem.trim(), explanation: input.explanation.trim(),
    choices: Object.freeze(choices), mappings: Object.freeze(input.mappings.map(defineBlueprintMapping)) });
}

export function isCorrectAnswer(item: QuestionItemVersion, choiceId: string): boolean {
  if (!item.choices.some(({ id }) => id === choiceId)) throw new McqError("MCQ_ANSWER_INVALID", "Réponse invalide.", "Choice does not belong to the item.", { itemId: item.itemId, version: item.version });
  return choiceId === item.correctChoiceId;
}
