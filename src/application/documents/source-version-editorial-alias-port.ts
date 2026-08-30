import type { EditorialSourceAlias } from "@/domain/documents/editorial-source-alias";

export type SourceVersionEditorialAliasRecord = Readonly<{
  aliasId: string;
  editorialAlias: EditorialSourceAlias;
  sourceVersionId: string;
  createdAt: string;
  actorId: string;
  traceId: string;
  provenance: "MANUAL_EDITORIAL_ASSOCIATION";
}>;

export type AssociateSourceVersionEditorialAliasPersistenceResult = Readonly<{
  status: "CREATED" | "UNCHANGED";
  association: SourceVersionEditorialAliasRecord;
}>;

export interface SourceVersionEditorialAliasPort {
  associate(record: SourceVersionEditorialAliasRecord): Promise<AssociateSourceVersionEditorialAliasPersistenceResult>;
  resolve(editorialAlias: EditorialSourceAlias): Promise<SourceVersionEditorialAliasRecord | null>;
}
