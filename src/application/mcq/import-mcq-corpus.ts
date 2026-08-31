import type { UseCase } from "@/application/contracts";
import { defineQuestionItemVersion } from "@/domain/mcq/question-item";
import { AppError } from "@/shared/errors/app-error";
import type { McqCorpus } from "./mcq-corpus-contract";

export type EditorialStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "RETIRED";
export type McqDocumentReference = Readonly<{ type: "PAGE" | "SECTION" | "URL" | "DOCUMENT"; locator: string; label: string }>;
export type McqCorpusWriteItem = Readonly<{
  question: ReturnType<typeof defineQuestionItemVersion>;
  editorial: Readonly<{
    status: EditorialStatus;
    sourceVersionId: string;
    reference: McqDocumentReference;
    corpusId: string;
    corpusVersion: number;
    contentChecksum: string;
    importedAt: string;
  }>;
}>;
export type McqCorpusWriteResult = Readonly<{ created: number; unchanged: number }>;

export interface McqCorpusWritePort { import(items: readonly McqCorpusWriteItem[]): Promise<McqCorpusWriteResult>; }
export interface McqContentChecksumPort { checksum(value: string): string; }
export interface McqImportClock { now(): string; }

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`).join(",")}}`;
  return JSON.stringify(value);
}

export class ImportMcqCorpus implements UseCase<McqCorpus, McqCorpusWriteResult> {
  constructor(private readonly writer: McqCorpusWritePort, private readonly checksums: McqContentChecksumPort, private readonly clock: McqImportClock) {}

  async execute(corpus: McqCorpus): Promise<McqCorpusWriteResult> {
    const keys = corpus.items.map(item => `${item.itemId}:${item.version}`);
    if (new Set(keys).size !== keys.length) throw new AppError({ code: "MCQ_CORPUS_DUPLICATE_ITEM", userMessage: "Le corpus contient une version de question en double.", category: "validation" });
    const importedAt = this.clock.now();
    const items = corpus.items.map(item => {
      const question = defineQuestionItemVersion({
        itemId: item.itemId,
        version: item.version,
        stem: item.stem,
        choices: item.choices,
        correctChoiceId: item.correctChoiceId,
        explanation: item.explanation,
        difficulty: item.difficulty,
        provenance: `SOURCE_VERSION:${item.source.sourceVersionId}`,
        mappings: item.mappings.map(mapping => ({ blueprintVersionId: corpus.blueprintVersionId, ...mapping })),
      });
      const contentChecksum = this.checksums.checksum(canonical({ question, status: item.status, source: item.source, corpusId: corpus.corpusId, corpusVersion: corpus.corpusVersion }));
      return { question, editorial: { status: item.status, sourceVersionId: item.source.sourceVersionId, reference: item.source.reference, corpusId: corpus.corpusId, corpusVersion: corpus.corpusVersion, contentChecksum, importedAt } } satisfies McqCorpusWriteItem;
    });
    return this.writer.import(items);
  }
}
