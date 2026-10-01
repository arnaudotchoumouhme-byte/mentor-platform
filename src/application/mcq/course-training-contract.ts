import { z } from "zod";
import { mcqCorpusSchema, type McqCorpus } from "./mcq-corpus-contract";

export const PERSONAL_CORPUS_PREFIX = "PERSONAL-COURSE:";
export const MAX_COURSE_DRAFTS = 2;
export const courseEditSchema = mcqCorpusSchema.shape.items.element.pick({ stem: true, choices: true, correctChoiceId: true, explanation: true });
export type CourseEdit = z.infer<typeof courseEditSchema>;
export type PriorCourseQuestion = Readonly<{ itemId: string; stem: string; pageStart: number; pageEnd: number; status: "PUBLISHED" | "RETIRED" }>;
export type CourseSource = Readonly<{
  documentId: number;
  name: string;
  sourceVersionId: string;
  text: string;
  pages?: readonly Readonly<{ pageNumber: number; text: string }>[];
  pageStart?: number;
  pageEnd?: number;
  nextPageNumber?: number;
  previousQuestions?: readonly PriorCourseQuestion[];
}>;
export type CourseQuestion = McqCorpus["items"][number];
export type CourseRecord = Readonly<{ corpusId: string; blueprintVersionId: string; item: CourseQuestion }>;
export interface CourseTrainingRepository {
  resolve(documentId: number, learnerId: string): CourseSource;
  list(source: CourseSource): readonly CourseRecord[];
  save(corpus: McqCorpus): Promise<unknown>;
}
export type ProviderGate = (
  operation: () => Promise<readonly CourseQuestion[]>,
) => Promise<readonly CourseQuestion[]>;
export interface CourseQuestionGenerator {
  generate(source: CourseSource, count: number, providerGate?: ProviderGate): Promise<readonly CourseQuestion[]>;
}

export const courseCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), desiredQuestionCount: z.number().int().min(1).max(MAX_COURSE_DRAFTS).default(MAX_COURSE_DRAFTS) }).strict(),
  z.object({ action: z.enum(["edit", "approve", "reject"]), itemId: z.string().min(1).max(200), expectedVersion: z.number().int().positive(), edit: courseEditSchema.optional() }).strict(),
  z.object({ action: z.literal("publish"), approvals: z.array(z.object({ itemId: z.string().min(1).max(200), expectedVersion: z.number().int().positive() }).strict()).min(1).max(100), confirmReviewed: z.literal(true) }).strict(),
]);
export type CourseCommand = z.infer<typeof courseCommandSchema>;
