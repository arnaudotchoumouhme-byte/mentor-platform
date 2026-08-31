import type { McqCorpusWriteItem, McqCorpusWritePort, McqCorpusWriteResult } from "@/application/mcq/import-mcq-corpus";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { AppError } from "@/shared/errors/app-error";

type ExistingItem = Readonly<{ latest_version: number }>;
type ExistingVersion = Readonly<{
  stem: string;
  choices_json: string;
  correct_choice_id: string;
  explanation: string;
  difficulty: string;
  provenance: string;
  editorial_status: string;
  source_version_id: string;
  reference_type: string;
  reference_locator: string;
  reference_label: string;
  corpus_id: string;
  corpus_version: number;
  content_checksum: string;
}>;
type ExistingMapping = Readonly<{ blueprint_version_id: string; domain_id: string; competency_id: string; topic_id: string; objective_id: string }>;

function samePersistedVersion(existing: ExistingVersion, mappings: readonly ExistingMapping[], item: McqCorpusWriteItem): boolean {
  const { question, editorial } = item;
  const expectedMappings = question.mappings.flatMap(mapping => mapping.objectiveIds.map(objectiveId => ({
    blueprint_version_id: mapping.blueprintVersionId,
    domain_id: mapping.domainId,
    competency_id: mapping.competencyId,
    topic_id: mapping.topicId,
    objective_id: objectiveId,
  }))).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const actualMappings = [...mappings].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return existing.stem === question.stem
    && existing.choices_json === JSON.stringify(question.choices)
    && existing.correct_choice_id === question.correctChoiceId
    && existing.explanation === question.explanation
    && existing.difficulty === question.difficulty
    && existing.provenance === question.provenance
    && existing.editorial_status === editorial.status
    && existing.source_version_id === editorial.sourceVersionId
    && existing.reference_type === editorial.reference.type
    && existing.reference_locator === editorial.reference.locator
    && existing.reference_label === editorial.reference.label
    && existing.corpus_id === editorial.corpusId
    && existing.corpus_version === editorial.corpusVersion
    && JSON.stringify(actualMappings) === JSON.stringify(expectedMappings);
}

export class SqliteMcqCorpusWriter implements McqCorpusWritePort {
  constructor(private readonly database: SqliteExecutor) {}

  async import(items: readonly McqCorpusWriteItem[]): Promise<McqCorpusWriteResult> {
    this.database.run("BEGIN IMMEDIATE");
    let created = 0;
    let unchanged = 0;
    try {
      for (const item of items) {
        const { question, editorial } = item;
        const source = this.database.all<{ source_version_id: string }>("SELECT source_version_id FROM source_versions WHERE source_version_id=?", editorial.sourceVersionId)[0];
        if (!source) throw new AppError({ code: "MCQ_SOURCE_VERSION_NOT_FOUND", userMessage: "La source d’une question est introuvable.", category: "validation" });
        const existingVersion = this.database.all<ExistingVersion>("SELECT v.stem,v.choices_json,v.correct_choice_id,v.explanation,v.difficulty,v.provenance,e.editorial_status,e.source_version_id,e.reference_type,e.reference_locator,e.reference_label,e.corpus_id,e.corpus_version,e.content_checksum FROM mcq_question_versions v JOIN mcq_item_editorial_metadata e ON e.item_id=v.item_id AND e.item_version=v.version WHERE v.item_id=? AND v.version=?", question.itemId, question.version)[0];
        if (existingVersion) {
          const mappings = this.database.all<ExistingMapping>("SELECT blueprint_version_id,domain_id,competency_id,topic_id,objective_id FROM mcq_item_mappings WHERE item_id=? AND item_version=?", question.itemId, question.version);
          if (existingVersion.content_checksum !== editorial.contentChecksum || !samePersistedVersion(existingVersion, mappings, item)) throw new AppError({ code: "MCQ_ITEM_VERSION_CONFLICT", userMessage: "Une version existante ne peut pas être réécrite.", category: "validation" });
          unchanged += 1;
          continue;
        }
        if (this.database.all("SELECT item_id FROM mcq_question_versions WHERE item_id=? AND version=?", question.itemId, question.version)[0]) {
          throw new AppError({ code: "MCQ_ITEM_VERSION_CONFLICT", userMessage: "Une version existante ne peut pas être réécrite.", category: "validation" });
        }
        const itemRow = this.database.all<ExistingItem>("SELECT latest_version FROM mcq_question_items WHERE item_id=?", question.itemId)[0];
        if (!itemRow && question.version !== 1) throw new AppError({ code: "MCQ_ITEM_VERSION_GAP", userMessage: "La première version d’une question doit être la version 1.", category: "validation" });
        if (itemRow && question.version !== itemRow.latest_version + 1) throw new AppError({ code: "MCQ_ITEM_VERSION_GAP", userMessage: "Les versions d’une question doivent être consécutives.", category: "validation" });
        if (!itemRow) this.database.run("INSERT INTO mcq_question_items(item_id,latest_version) VALUES(?,?)", question.itemId, question.version);
        this.database.run("INSERT INTO mcq_question_versions(item_id,version,stem,choices_json,correct_choice_id,explanation,difficulty,provenance) VALUES(?,?,?,?,?,?,?,?)", question.itemId, question.version, question.stem, JSON.stringify(question.choices), question.correctChoiceId, question.explanation, question.difficulty, question.provenance);
        for (const mapping of question.mappings) for (const objectiveId of mapping.objectiveIds) {
          this.database.run("INSERT INTO mcq_item_mappings(item_id,item_version,blueprint_version_id,domain_id,competency_id,topic_id,objective_id) VALUES(?,?,?,?,?,?,?)", question.itemId, question.version, mapping.blueprintVersionId, mapping.domainId, mapping.competencyId, mapping.topicId, objectiveId);
        }
        this.database.run("INSERT INTO mcq_item_editorial_metadata(item_id,item_version,editorial_status,source_version_id,reference_type,reference_locator,reference_label,corpus_id,corpus_version,content_checksum,imported_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)", question.itemId, question.version, editorial.status, editorial.sourceVersionId, editorial.reference.type, editorial.reference.locator, editorial.reference.label, editorial.corpusId, editorial.corpusVersion, editorial.contentChecksum, editorial.importedAt);
        if (itemRow) this.database.run("UPDATE mcq_question_items SET latest_version=? WHERE item_id=?", question.version, question.itemId);
        created += 1;
      }
      this.database.run("COMMIT");
      return { created, unchanged };
    } catch (error) {
      this.database.run("ROLLBACK");
      throw error;
    }
  }
}
