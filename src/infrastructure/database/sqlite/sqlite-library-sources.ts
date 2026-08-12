import "server-only";
import type { LibraryDocument, LibrarySourcePort } from "@/application/documents/library-source-port";
import type { SqliteExecutor } from "./sqlite-executor";

const SELECT_LIBRARY_DOCUMENTS = `SELECT
  d.id,d.name,d.type,d.size,d.subject,d.status,d.content,d.archived,d.created_at,
  s.source_id,sv.source_version_id,
  COALESCE(s.provenance_type,CASE WHEN d.name LIKE '[DÉMO]%' THEN 'DEMO' ELSE 'LEGACY_UNCLASSIFIED' END) AS provenance_type,
  COALESCE(s.extraction_status,'LEGACY') AS extraction_status,
  s.media_type,s.language,s.page_count
FROM documents d
LEFT JOIN sources s ON s.document_id=d.id AND s.status<>'DELETED'
LEFT JOIN source_versions sv ON sv.source_id=s.source_id AND sv.version=s.version`;

export class SqliteLibrarySources implements LibrarySourcePort {
  constructor(private readonly database: SqliteExecutor) {}

  list(): readonly LibraryDocument[] {
    return this.database.all<LibraryDocument>(`${SELECT_LIBRARY_DOCUMENTS} ORDER BY d.archived,d.created_at DESC`);
  }

  getByDocumentId(id: number): LibraryDocument | null {
    return this.database.all<LibraryDocument>(`${SELECT_LIBRARY_DOCUMENTS} WHERE d.id=? LIMIT 1`, id)[0] ?? null;
  }
}
