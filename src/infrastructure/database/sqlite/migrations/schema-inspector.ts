import type { DatabaseSchemaSnapshot } from "./schema-snapshot";

export interface SchemaInspector {
  inspect(): DatabaseSchemaSnapshot;
}
