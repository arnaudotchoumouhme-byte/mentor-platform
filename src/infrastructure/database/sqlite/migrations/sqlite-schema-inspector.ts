import type { SqliteExecutor } from "../sqlite-executor";
import { MigrationError } from "./migration-errors";
import type { SchemaInspector } from "./schema-inspector";
import type {
  ColumnSchema,
  DatabaseSchemaSnapshot,
  ForeignKeySchema,
  IndexColumnSchema,
  IndexSchema,
  SchemaTableKind,
  TableSchema,
} from "./schema-snapshot";
import { MIGRATION_HISTORY_TABLE } from "./sqlite-migration-history-store";

type MasterRow = Readonly<{
  type: "table" | "view" | "trigger";
  name: string;
  table_name: string;
  sql: string | null;
}>;

type ColumnRow = Readonly<{
  cid: number;
  name: string;
  type: string;
  not_null: number;
  default_value: string | null;
  pk: number;
  hidden: number;
}>;

type ForeignKeyRow = Readonly<{
  id: number;
  seq: number;
  target_table: string;
  from_column: string;
  to_column: string | null;
  on_update: string;
  on_delete: string;
  match: string;
}>;

type IndexRow = Readonly<{
  name: string;
  is_unique: number;
  origin: string;
  partial: number;
}>;

type IndexColumnRow = Readonly<{
  seqno: number;
  cid: number;
  name: string | null;
  descending: number;
  collation: string;
  is_key: number;
}>;

function tableKind(name: string): SchemaTableKind {
  if (name.startsWith("sqlite_")) return "SQLITE_INTERNAL";
  if (name === MIGRATION_HISTORY_TABLE) return "MIGRATION_METADATA_TABLE";
  return "APPLICATION_TABLE";
}

function freezeArray<T>(items: T[]): readonly T[] {
  return Object.freeze(items);
}

function normalizeDefinitionSql(sql: string | null): string {
  return (sql ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

export class SqliteSchemaInspector implements SchemaInspector {
  constructor(private readonly database: SqliteExecutor) {}

  inspect(): DatabaseSchemaSnapshot {
    try {
      const objects = this.database.all<MasterRow>(
        `SELECT type,name,tbl_name AS table_name,sql
         FROM sqlite_master
         WHERE type IN ('table','view','trigger')
         ORDER BY type ASC,name ASC`,
      );
      const tables = objects
        .filter((object) => object.type === "table")
        .map((object) => this.inspectTable(object));
      const views = objects
        .filter((object) => object.type === "view")
        .map((object) => Object.freeze({ name: object.name, sql: object.sql ?? "" }));
      const triggers = objects
        .filter((object) => object.type === "trigger")
        .map((object) =>
          Object.freeze({
            name: object.name,
            tableName: object.table_name,
            sql: object.sql ?? "",
          }),
        );

      return Object.freeze({
        tables: freezeArray(tables),
        views: freezeArray(views),
        triggers: freezeArray(triggers),
      });
    } catch (cause) {
      throw new MigrationError(
        "SCHEMA_INSPECTION_ERROR",
        "Unable to inspect SQLite schema metadata.",
        { cause },
      );
    }
  }

  private inspectTable(object: MasterRow): TableSchema {
    const columns = this.database
      .all<ColumnRow>(
        `SELECT cid,name,type,"notnull" AS not_null,dflt_value AS default_value,pk,hidden
         FROM pragma_table_xinfo(?)
         ORDER BY cid ASC`,
        object.name,
      )
      .map<ColumnSchema>((column) =>
        Object.freeze({
          position: column.cid,
          name: column.name,
          declaredType: column.type.toUpperCase(),
          nullable: column.not_null === 0,
          defaultValue: column.default_value,
          primaryKeyPosition: column.pk,
          hidden: column.hidden,
        }),
      );
    const foreignKeys = this.database
      .all<ForeignKeyRow>(
        `SELECT id,seq,"table" AS target_table,"from" AS from_column,"to" AS to_column,
                on_update,on_delete,"match" AS match
         FROM pragma_foreign_key_list(?)
         ORDER BY id ASC,seq ASC`,
        object.name,
      )
      .map<ForeignKeySchema>((foreignKey) =>
        Object.freeze({
          id: foreignKey.id,
          sequence: foreignKey.seq,
          targetTable: foreignKey.target_table,
          fromColumn: foreignKey.from_column,
          toColumn: foreignKey.to_column,
          onUpdate: foreignKey.on_update,
          onDelete: foreignKey.on_delete,
          match: foreignKey.match,
        }),
      );
    const indexes = this.database
      .all<IndexRow>(
        `SELECT name,"unique" AS is_unique,origin,partial
         FROM pragma_index_list(?)
         ORDER BY name ASC`,
        object.name,
      )
      .map<IndexSchema>((index) => {
        const columnsForIndex = this.database
          .all<IndexColumnRow>(
            `SELECT seqno,cid,name,"desc" AS descending,coll AS collation,"key" AS is_key
             FROM pragma_index_xinfo(?)
             ORDER BY seqno ASC`,
            index.name,
          )
          .map<IndexColumnSchema>((column) =>
            Object.freeze({
              sequence: column.seqno,
              columnId: column.cid,
              name: column.name,
              descending: column.descending === 1,
              collation: column.collation,
              key: column.is_key === 1,
            }),
          );
        return Object.freeze({
          name: index.name,
          unique: index.is_unique === 1,
          origin: index.origin,
          partial: index.partial === 1,
          columns: freezeArray(columnsForIndex),
        });
      });

    return Object.freeze({
      name: object.name,
      kind: tableKind(object.name),
      virtual: /^\s*CREATE\s+VIRTUAL\s+TABLE\b/i.test(object.sql ?? ""),
      definitionSql: normalizeDefinitionSql(object.sql),
      columns: freezeArray(columns),
      foreignKeys: freezeArray(foreignKeys),
      indexes: freezeArray(indexes),
    });
  }
}
