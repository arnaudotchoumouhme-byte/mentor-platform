export type LibraryDocument = Readonly<{
  id: number;
  name: string;
  type: string;
  size: number;
  subject: string;
  status: string;
  content: string;
  archived: number;
  created_at: string;
  source_id: string | null;
  source_version_id: string | null;
  provenance_type: string;
  extraction_status: string;
  media_type: string | null;
  language: string | null;
  page_count: number | null;
}>;

export interface LibrarySourcePort {
  list(): readonly LibraryDocument[];
  getByDocumentId(id: number): LibraryDocument | null;
}
