import { z } from "zod";

const identifier = z.string().trim().min(1).max(200);
const sourceVersionId = z.uuid();
const choice = z.object({ id: identifier, text: z.string().trim().min(1).max(2_000) }).strict();
const mapping = z.object({
  domainId: identifier,
  competencyId: identifier,
  topicId: identifier,
  objectiveIds: z.array(identifier).min(1).max(100),
}).strict();
const reference = z.object({
  type: z.enum(["PAGE", "SECTION", "URL", "DOCUMENT"]),
  locator: z.string().trim().min(1).max(500),
  label: z.string().trim().min(1).max(500),
}).strict();

export const mcqCorpusSchema = z.object({
  schemaVersion: z.literal("MCQ_CORPUS/1"),
  corpusId: identifier,
  corpusVersion: z.number().int().min(1),
  blueprintVersionId: identifier,
  items: z.array(z.object({
    itemId: identifier,
    version: z.number().int().min(1),
    status: z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "RETIRED"]),
    stem: z.string().trim().min(1).max(20_000),
    choices: z.array(choice).min(2).max(20),
    correctChoiceId: identifier,
    explanation: z.string().trim().min(1).max(20_000),
    difficulty: z.enum(["FOUNDATION", "INTERMEDIATE", "ADVANCED"]),
    source: z.object({ sourceVersionId, reference }).strict(),
    mappings: z.array(mapping).min(1).max(100),
  }).strict()).min(1).max(10_000),
}).strict();

export type McqCorpus = z.infer<typeof mcqCorpusSchema>;

export function parseMcqCorpus(input: unknown): McqCorpus {
  return mcqCorpusSchema.parse(input);
}
