import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { courseFailure } from "@/application/mcq/course-training";
import { PERSONAL_CORPUS_PREFIX, type CourseSource, type CourseRecord, type CourseTrainingRepository } from "@/application/mcq/course-training-contract";
import type { ImportMcqCorpus } from "@/application/mcq/import-mcq-corpus";
import type { McqCorpus } from "@/application/mcq/mcq-corpus-contract";

export class SqliteCourseTraining implements CourseTrainingRepository {
  constructor(private readonly db: SqliteExecutor, private readonly importer: ImportMcqCorpus) {}
  resolve(documentId: number, learnerId: string): CourseSource {
    const row = this.db.all<CourseSource & { status: string; extraction: string; versionExtraction: string }>(`SELECT d.id AS documentId,d.name,s.status,s.extraction_status AS extraction,v.extraction_status AS versionExtraction,v.source_version_id AS sourceVersionId,v.extracted_content AS text FROM documents d JOIN learner_document_ownership o ON o.document_id=d.id JOIN sources s ON s.document_id=d.id JOIN source_versions v ON v.source_id=s.source_id AND v.version=s.version WHERE d.id=? AND o.learner_id=? AND d.archived=0 AND s.provenance_type='USER_UPLOAD' AND s.status<>'DELETED'`, documentId, learnerId)[0];
    if (!row) courseFailure("Accès refusé.", "FORBIDDEN");
    if (row.status !== "READY" || row.extraction !== "COMPLETED" || row.versionExtraction !== "COMPLETED" || !row.text?.trim()) courseFailure("Ce cours n’est pas encore prêt.", "CONFLICT");
    const pages = this.db.all<{pageNumber:number;text:string}>("SELECT page_number AS pageNumber,text FROM source_version_pages WHERE source_version_id=? ORDER BY page_number", row.sourceVersionId);
    return { ...row, pages };
  }
  list(source: CourseSource): readonly CourseRecord[] {
    const rows = this.db.all<{ item_id: string; item_version: number; editorial_status: CourseRecord["item"]["status"]; corpus_id: string; reference_type: CourseRecord["item"]["source"]["reference"]["type"]; reference_locator: string; reference_label: string }>(`SELECT e.* FROM mcq_item_editorial_metadata e JOIN mcq_question_items i ON i.item_id=e.item_id AND i.latest_version=e.item_version WHERE e.source_version_id=? AND substr(e.corpus_id,1,?)=? ORDER BY e.corpus_id,e.item_id`, source.sourceVersionId, PERSONAL_CORPUS_PREFIX.length, PERSONAL_CORPUS_PREFIX);
    return rows.map(row => {
      const q = this.db.all<{ stem: string; choices_json: string; correct_choice_id: string; explanation: string; difficulty: CourseRecord["item"]["difficulty"] }>("SELECT * FROM mcq_question_versions WHERE item_id=? AND version=?", row.item_id, row.item_version)[0];
      const mappings = this.db.all<{ blueprint_version_id: string; domain_id: string; competency_id: string; topic_id: string; objective_id: string }>("SELECT * FROM mcq_item_mappings WHERE item_id=? AND item_version=?", row.item_id, row.item_version);
      return { corpusId: row.corpus_id, blueprintVersionId: mappings[0].blueprint_version_id, item: { itemId: row.item_id, version: row.item_version, status: row.editorial_status, stem: q.stem, choices: JSON.parse(q.choices_json), correctChoiceId: q.correct_choice_id, explanation: q.explanation, difficulty: q.difficulty, source: { sourceVersionId: source.sourceVersionId, reference: { type: row.reference_type, locator: row.reference_locator, label: row.reference_label } }, mappings: mappings.map(m => ({ domainId: m.domain_id, competencyId: m.competency_id, topicId: m.topic_id, objectiveIds: [m.objective_id] })) } };
    });
  }
  save(corpus: McqCorpus) { return this.importer.execute(corpus); }
}
