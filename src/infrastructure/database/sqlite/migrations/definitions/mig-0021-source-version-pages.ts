import type { SqliteExecutor } from "../../sqlite-executor";
import { MigrationError } from "../migration-errors";

export const SOURCE_VERSION_PAGES_SQL = `CREATE TABLE source_version_pages (
  source_version_id TEXT NOT NULL REFERENCES source_versions(source_version_id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (typeof(page_number) = 'integer' AND page_number >= 1),
  text TEXT NOT NULL,
  PRIMARY KEY (source_version_id, page_number)
)`;
export const IMPORT_PAGES_SQL = "ALTER TABLE document_import_journal ADD COLUMN pages_json TEXT";
export const sourceVersionPagesMigration = {
  id: "MIG-0021", fromVersion: 20, toVersion: 21,
  description: "Preserve extracted pages and crash recovery payload",
  checksumMaterial: [SOURCE_VERSION_PAGES_SQL, IMPORT_PAGES_SQL, "postcondition:source-version-pages-v1"],
  up(db: SqliteExecutor) { db.run(SOURCE_VERSION_PAGES_SQL); db.run(IMPORT_PAGES_SQL); },
  validate(db: SqliteExecutor) {
    const columns = db.all<{name:string;type:string;pk:number;notnull:number}>("PRAGMA table_info(source_version_pages)");
    const keys = db.all<{from:string;table:string;to:string;on_delete:string}>("PRAGMA foreign_key_list(source_version_pages)");
    const journal = db.all<{name:string;type:string;notnull:number}>("PRAGMA table_info(document_import_journal)");
    const sql = db.all<{sql:string}>("SELECT sql FROM sqlite_schema WHERE name='source_version_pages'")[0]?.sql ?? "";
    if (columns.length !== 3 || !columns.some(c=>c.name==='source_version_id' && c.type==='TEXT' && c.pk===1 && c.notnull===1)
      || !columns.some(c=>c.name==='page_number' && c.type==='INTEGER' && c.pk===2 && c.notnull===1)
      || !columns.some(c=>c.name==='text' && c.type==='TEXT' && c.notnull===1)
      || !keys.some(k=>k.from==='source_version_id' && k.table==='source_versions' && k.to==='source_version_id' && k.on_delete==='CASCADE')
      || !journal.some(c=>c.name==='pages_json' && c.type==='TEXT' && c.notnull===0)
      || !/CHECK\s*\(\s*typeof\s*\(\s*page_number\s*\)\s*=\s*'integer'\s+AND\s+page_number\s*>=\s*1\s*\)/i.test(sql)) {
      throw new MigrationError("MIGRATION_SCHEMA_POSTCONDITION_FAILED", "Source version pages schema is incomplete.");
    }
  },
} as const;
