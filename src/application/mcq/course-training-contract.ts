import { z } from "zod";
import { mcqCorpusSchema, type McqCorpus } from "./mcq-corpus-contract";

export const PERSONAL_CORPUS_PREFIX = "PERSONAL-COURSE:";
export const courseEditSchema = mcqCorpusSchema.shape.items.element.pick({ stem: true, choices: true, correctChoiceId: true, explanation: true });
export type CourseEdit = z.infer<typeof courseEditSchema>;
export type CourseSource = Readonly<{ documentId: number; name: string; sourceVersionId: string; text: string }>;
export type CourseQuestion = McqCorpus["items"][number];
export type CourseRecord = Readonly<{ corpusId: string; blueprintVersionId: string; item: CourseQuestion }>;
export interface CourseTrainingRepository {
  resolve(documentId: number, learnerId: string): CourseSource;
  list(source: CourseSource): readonly CourseRecord[];
  save(corpus: McqCorpus): Promise<unknown>;
}
export interface CourseQuestionGenerator {
  generate(source: CourseSource, count: number): Promise<readonly CourseQuestion[]>;
}

export const courseCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), desiredQuestionCount: z.number().int().min(1).max(10).default(10) }).strict(),
  z.object({ action: z.enum(["edit", "approve", "reject"]), itemId: z.string().min(1).max(200), expectedVersion: z.number().int().positive(), edit: courseEditSchema.optional() }).strict(),
  z.object({ action: z.literal("publish"), approvals: z.array(z.object({ itemId: z.string().min(1).max(200), expectedVersion: z.number().int().positive() }).strict()).min(1).max(100), confirmReviewed: z.literal(true) }).strict(),
]);
export type CourseCommand = z.infer<typeof courseCommandSchema>;
