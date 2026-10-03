import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { PERSONAL_CORPUS_PREFIX } from "@/application/mcq/course-training-contract";
import { courseFailure } from "@/application/mcq/course-training";

/** e is the editorial metadata alias in both catalog queries. Default: no private corpus. */
export function courseCatalogAccess(db: SqliteExecutor, learnerId?: string, documentId?: number) {
  const parameters: (string | number)[] = [PERSONAL_CORPUS_PREFIX.length, PERSONAL_CORPUS_PREFIX, PERSONAL_CORPUS_PREFIX.length, PERSONAL_CORPUS_PREFIX, learnerId ?? ""];
  let sql = `( (substr(e.corpus_id,1,?)<>? AND substr(e.item_id,1,?)<>?) OR EXISTS (SELECT 1 FROM source_versions pv JOIN sources ps ON ps.source_id=pv.source_id JOIN learner_document_ownership po ON po.document_id=ps.document_id WHERE pv.source_version_id=e.source_version_id AND po.learner_id=? AND ps.status='READY' AND pv.extraction_status='COMPLETED') )`;
  if (documentId !== undefined) {
    const source = db.all<{ source_version_id: string }>(`SELECT v.source_version_id FROM sources s JOIN source_versions v ON v.source_id=s.source_id AND v.version=s.version JOIN learner_document_ownership o ON o.document_id=s.document_id JOIN documents d ON d.id=s.document_id WHERE s.document_id=? AND o.learner_id=? AND d.archived=0 AND s.provenance_type='USER_UPLOAD' AND s.status='READY' AND s.extraction_status='COMPLETED' AND v.extraction_status='COMPLETED'`, documentId, learnerId ?? "")[0];
    if (!source) courseFailure("Accès refusé.", "FORBIDDEN");
    sql += " AND e.source_version_id=?";
    parameters.push(source.source_version_id);
  }
  return { sql, parameters };
}
