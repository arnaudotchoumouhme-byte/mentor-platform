import type { Document } from "@/domain/documents/document";
import type { SqliteDocumentRecord } from "../records/document-record";

export function toDocument(record: SqliteDocumentRecord): Document {
  return {
    id: record.id,
    name: record.name,
    content: record.content,
    archived: record.archived === 1,
  };
}
