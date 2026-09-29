import { AppError } from "@/shared/errors/app-error";
import { parseMcqCorpus } from "./mcq-corpus-contract";
import { PERSONAL_CORPUS_PREFIX, MAX_COURSE_DRAFTS, courseEditSchema, type CourseCommand, type CourseQuestion, type CourseQuestionGenerator, type CourseTrainingRepository } from "./course-training-contract";
import { validateCourseReview } from "./course-review-validation";

export function courseFailure(message: string, code = "VALIDATION_ERROR"): never {
  throw new AppError({ code, userMessage: message, category: code === "FORBIDDEN" ? "security" : "validation" });
}

/** Review decisions are new immutable versions; IN_REVIEW denotes explicit owner approval. */
export class CourseTraining {
  private readonly generating = new Set<string>();
  constructor(private readonly repository: CourseTrainingRepository, private readonly generator: CourseQuestionGenerator, private readonly nextId: () => string) {}
  read(documentId: number, learnerId: string) {
    const source = this.repository.resolve(documentId, learnerId);
    return { name: source.name, questions: this.repository.list(source).map(({ item }) => ({ itemId: item.itemId, version: item.version, status: item.status, stem: item.stem, choices: item.choices, correctChoiceId: item.correctChoiceId, explanation: item.explanation, reference: item.source.reference.label, mappings: item.mappings })) };
  }
  async execute(documentId: number, learnerId: string, command: CourseCommand) {
    if (command.action === "generate" && (!Number.isInteger(command.desiredQuestionCount) || command.desiredQuestionCount < 1 || command.desiredQuestionCount > MAX_COURSE_DRAFTS)) courseFailure("Le lot contrôlé est limité à deux questions.");
    const source = this.repository.resolve(documentId, learnerId);
    const records = this.repository.list(source);
    if (command.action === "generate") {
      if (records.some(r => r.item.status === "DRAFT" || r.item.status === "IN_REVIEW") || this.generating.has(source.sourceVersionId)) courseFailure("Terminez la revue du lot existant.", "CONFLICT");
      this.generating.add(source.sourceVersionId);
      try {
        const generated = await this.generator.generate(source, command.desiredQuestionCount);
        if (generated.length !== command.desiredQuestionCount) courseFailure("Le nombre de questions générées est incomplet.");
        const current = this.repository.resolve(documentId, learnerId);
        if (current.sourceVersionId !== source.sourceVersionId) courseFailure("Le cours a changé. Recommencez depuis la bibliothèque.", "CONFLICT");
        if (this.repository.list(current).some(r => r.item.status === "DRAFT" || r.item.status === "IN_REVIEW")) courseFailure("Un lot a déjà été préparé. Actualisez la revue.", "CONFLICT");
        const corpusId = PERSONAL_CORPUS_PREFIX + this.nextId();
        const items = generated.map(item => ({ ...item, itemId: PERSONAL_CORPUS_PREFIX + this.nextId(), version: 1, status: "DRAFT" as const, source: { ...item.source, sourceVersionId: source.sourceVersionId } }));
        await this.repository.save(parseMcqCorpus({ schemaVersion: "MCQ_CORPUS/1", corpusId, corpusVersion: 1, blueprintVersionId: "PEBC-PART-I-2026", items }));
      } finally { this.generating.delete(source.sourceVersionId); }
    } else {
      if (command.action === "publish" && command.confirmReviewed !== true) courseFailure("Confirmez la revue avant publication.");
      const requests = command.action === "publish" ? command.approvals : [command];
      if (new Set(requests.map(r => r.itemId)).size !== requests.length) courseFailure("Sélection dupliquée.");
      const selected = requests.map(request => {
        const record = records.find(r => r.item.itemId === request.itemId);
        if (!record) courseFailure("Accès refusé.", "FORBIDDEN");
        if (record.item.version !== request.expectedVersion) courseFailure("La question a changé. Actualisez la revue.", "CONFLICT");
        if (record.item.status === "PUBLISHED" || record.item.status === "RETIRED") courseFailure("Cette question n’est plus modifiable.", "CONFLICT");
        if (command.action === "publish" && record.item.status !== "IN_REVIEW") courseFailure("Validez chaque question avant publication.");
        return record;
      });
      // One batch only: prevents partial publication across independent generation lots.
      if (new Set(selected.map(r => r.corpusId)).size !== 1) courseFailure("Publiez un seul lot à la fois.");
      const items: CourseQuestion[] = selected.map(({ item }) => ({ ...item,
        ...(command.action === "edit" ? courseEditSchema.parse(command.edit ?? courseFailure("Modification manquante.")) : {}),
        version: item.version + 1,
        status: command.action === "publish" ? "PUBLISHED" : command.action === "approve" ? "IN_REVIEW" : command.action === "reject" ? "RETIRED" : "DRAFT",
      }));
      if (command.action !== "reject") {
        for (const item of items) {
          validateCourseReview(item, source);
          if (command.action !== "edit" && item.explanation.includes("HUMAN_REVIEW_REQUIRED: INSUFFICIENT_SOURCE")) courseFailure("Résolvez les éléments non étayés avant validation ou rejetez la question.");
        }
      }
      await this.repository.save(parseMcqCorpus({ schemaVersion: "MCQ_CORPUS/1", corpusId: selected[0].corpusId, corpusVersion: Math.max(...items.map(i => i.version)), blueprintVersionId: selected[0].blueprintVersionId, items }));
    }
    return this.read(documentId, learnerId);
  }
}
