export type SqliteDocumentRecord = Readonly<{
  id: number;
  name: string;
  content: string;
  archived: number;
}>;
