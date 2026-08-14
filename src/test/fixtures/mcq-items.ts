import { defineBlueprintMapping } from "@/domain/mcq/blueprint-mapping";
import { defineQuestionItemVersion, type QuestionItemVersion } from "@/domain/mcq/question-item";

export const SYNTHETIC_MCQ_MAPPING = defineBlueprintMapping({ blueprintVersionId: "bp-v1", domainId: "care", competencyId: "assessment", topicId: "renal", objectiveIds: ["obj-1"] });
export const syntheticMcqItem = (id = "item-1", version = 1): QuestionItemVersion => defineQuestionItemVersion({ itemId: id, version, stem: "Question synthétique ?", choices: [{ id: "a", text: "Option A" }, { id: "b", text: "Option B" }], correctChoiceId: "a", explanation: "Explication synthétique.", difficulty: "FOUNDATION", provenance: "SYNTHETIC_FIXTURE", mappings: [SYNTHETIC_MCQ_MAPPING] });
