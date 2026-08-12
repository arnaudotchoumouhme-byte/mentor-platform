export type SchemaTableKind =
  | "APPLICATION_TABLE"
  | "MIGRATION_METADATA_TABLE"
  | "SQLITE_INTERNAL";

export type ColumnSchema = Readonly<{
  position: number;
  name: string;
  declaredType: string;
  nullable: boolean;
  defaultValue: string | null;
  primaryKeyPosition: number;
  hidden: number;
}>;

export type ForeignKeySchema = Readonly<{
  id: number;
  sequence: number;
  targetTable: string;
  fromColumn: string;
  toColumn: string | null;
  onUpdate: string;
  onDelete: string;
  match: string;
}>;

export type IndexColumnSchema = Readonly<{
  sequence: number;
  columnId: number;
  name: string | null;
  descending: boolean;
  collation: string;
  key: boolean;
}>;

export type IndexSchema = Readonly<{
  name: string;
  unique: boolean;
  origin: string;
  partial: boolean;
  columns: readonly IndexColumnSchema[];
}>;

export type TableSchema = Readonly<{
  name: string;
  kind: SchemaTableKind;
  virtual: boolean;
  definitionSql: string;
  columns: readonly ColumnSchema[];
  foreignKeys: readonly ForeignKeySchema[];
  indexes: readonly IndexSchema[];
}>;

export type ViewSchema = Readonly<{
  name: string;
  sql: string;
}>;

export type TriggerSchema = Readonly<{
  name: string;
  tableName: string;
  sql: string;
}>;

export type DatabaseSchemaSnapshot = Readonly<{
  tables: readonly TableSchema[];
  views: readonly ViewSchema[];
  triggers: readonly TriggerSchema[];
}>;
