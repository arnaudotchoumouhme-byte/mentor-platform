import type {
  AssociateSourceVersionEditorialAliasPersistenceResult,
  SourceVersionEditorialAliasPort,
  SourceVersionEditorialAliasRecord,
} from "@/application/documents/source-version-editorial-alias-port";
import type { EditorialSourceAlias } from "@/domain/documents/editorial-source-alias";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { AppError } from "@/shared/errors/app-error";

type AliasRow = Readonly<{ alias_id: string; editorial_alias: string; source_version_id: string; created_at: string; actor_id: string; trace_id: string; provenance: "MANUAL_EDITORIAL_ASSOCIATION" }>;
type ResolvedAliasRow = AliasRow & Readonly<{ source_status: string }>;
type SourceVersionRow = Readonly<{ source_version_id: string; source_id: string; version: number; version_checksum: string; extraction_status: string }>;
type SourceRow = Readonly<{ source_id: string; version: number; source_checksum: string; status: string; extraction_status: string }>;

function toRecord(row: AliasRow): SourceVersionEditorialAliasRecord {
  return Object.freeze({ aliasId: row.alias_id, editorialAlias: row.editorial_alias as EditorialSourceAlias, sourceVersionId: row.source_version_id, createdAt: row.created_at, actorId: row.actor_id, traceId: row.trace_id, provenance: row.provenance });
}

function conflict(code: string, message: string): never {
  throw new AppError({ code, userMessage: message, category: "validation", severity: "warn" });
}

export class SqliteSourceVersionEditorialAliasRepository implements SourceVersionEditorialAliasPort {
  constructor(private readonly database: SqliteExecutor) {}

  async associate(record: SourceVersionEditorialAliasRecord): Promise<AssociateSourceVersionEditorialAliasPersistenceResult> {
    this.database.run("BEGIN IMMEDIATE");
    try {
      const version = this.database.all<SourceVersionRow>("SELECT source_version_id,source_id,version,checksum AS version_checksum,extraction_status FROM source_versions WHERE source_version_id=?", record.sourceVersionId)[0];
      if (!version) conflict("SOURCE_VERSION_NOT_FOUND", "La version de source est introuvable.");
      const source = this.database.all<SourceRow>("SELECT source_id,version,checksum AS source_checksum,status,extraction_status FROM sources WHERE source_id=?", version.source_id)[0];
      if (!source) conflict("SOURCE_VERSION_SOURCE_NOT_FOUND", "La source liée est introuvable.");
      if (source.status === "DELETED") conflict("SOURCE_VERSION_SOURCE_DELETED", "La source liée est supprimée.");
      if (source.status !== "READY" || source.extraction_status !== "COMPLETED" || version.extraction_status !== "COMPLETED") conflict("SOURCE_VERSION_EXTRACTION_NOT_READY", "L’extraction de la source n’est pas exploitable.");
      if (version.version < 1 || source.version !== version.version || source.source_checksum !== version.version_checksum) conflict("SOURCE_VERSION_INCOHERENT", "La version de source est incohérente.");

      const byAlias = this.findByAlias(record.editorialAlias);
      const byVersion = this.findBySourceVersionId(record.sourceVersionId);
      if (byAlias && byAlias.sourceVersionId !== record.sourceVersionId) conflict("SOURCE_EDITORIAL_ALIAS_CONFLICT", "L’alias éditorial est déjà associé à une autre version.");
      if (byVersion && byVersion.editorialAlias !== record.editorialAlias) conflict("SOURCE_VERSION_EDITORIAL_ALIAS_CONFLICT", "La version possède déjà un autre alias éditorial.");
      if (byAlias && byVersion) {
        this.database.run("COMMIT");
        return Object.freeze({ status: "UNCHANGED", association: byAlias });
      }
      this.database.run("INSERT INTO source_version_editorial_aliases(alias_id,editorial_alias,source_version_id,created_at,actor_id,trace_id,provenance) VALUES(?,?,?,?,?,?,?)", record.aliasId, record.editorialAlias, record.sourceVersionId, record.createdAt, record.actorId, record.traceId, record.provenance);
      this.database.run("COMMIT");
      return Object.freeze({ status: "CREATED", association: record });
    } catch (error) {
      try { this.database.run("ROLLBACK"); } catch { /* Preserve the actionable cause. */ }
      throw error;
    }
  }

  async resolve(editorialAlias: EditorialSourceAlias): Promise<SourceVersionEditorialAliasRecord | null> {
    const row = this.database.all<ResolvedAliasRow>("SELECT a.alias_id,a.editorial_alias,a.source_version_id,a.created_at,a.actor_id,a.trace_id,a.provenance,s.status AS source_status FROM source_version_editorial_aliases a JOIN source_versions v ON v.source_version_id=a.source_version_id JOIN sources s ON s.source_id=v.source_id WHERE a.editorial_alias=?", editorialAlias)[0];
    if (row?.source_status === "DELETED") conflict("SOURCE_VERSION_SOURCE_DELETED", "La source liée est supprimée.");
    return row ? toRecord(row) : null;
  }

  private findByAlias(editorialAlias: EditorialSourceAlias): SourceVersionEditorialAliasRecord | null {
    const row = this.database.all<AliasRow>("SELECT alias_id,editorial_alias,source_version_id,created_at,actor_id,trace_id,provenance FROM source_version_editorial_aliases WHERE editorial_alias=?", editorialAlias)[0];
    return row ? toRecord(row) : null;
  }

  private findBySourceVersionId(sourceVersionId: string): SourceVersionEditorialAliasRecord | null {
    const row = this.database.all<AliasRow>("SELECT alias_id,editorial_alias,source_version_id,created_at,actor_id,trace_id,provenance FROM source_version_editorial_aliases WHERE source_version_id=?", sourceVersionId)[0];
    return row ? toRecord(row) : null;
  }
}
