import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { AssociateSourceVersionEditorialAlias, ResolveSourceVersionEditorialAlias } from "../src/application/documents/source-version-editorial-alias";
import type { SqliteExecutor } from "../src/infrastructure/database/sqlite/sqlite-executor";
import { SqliteSourceVersionEditorialAliasRepository } from "../src/infrastructure/documents/sqlite-source-version-editorial-alias-repository";
import { SqliteMigrationHistoryStore } from "../src/infrastructure/database/sqlite/migrations/sqlite-migration-history-store";
import { AppError } from "../src/shared/errors/app-error";
import { parseEditorialSourceAlias } from "../src/domain/documents/editorial-source-alias";
import { isSourceVersionAliasSchemaSupported, MAX_SUPPORTED_SCHEMA_VERSION } from "../src/infrastructure/database/sqlite/operational-schema-support";

const values = new Map(process.argv.slice(2).filter(value => value.startsWith("--") && value.includes("=")).map(value => { const [key, ...rest] = value.split("="); return [key, rest.join("=")]; }));
const flags = new Set(process.argv.slice(2).filter(value => value.startsWith("--") && !value.includes("=")));
const operation = values.get("--operation");
const databaseArgument = values.get("--database");
const editorialAlias = values.get("--alias");

if (!databaseArgument || !editorialAlias || !operation || !["associate", "resolve"].includes(operation)) {
  console.error("Usage: pnpm source-version-alias -- --operation=associate|resolve --database=<absolute-path> --alias=<ALIAS/V1> [--source-version-id=<uuid> --actor-id=<opaque-id> --trace-id=<uuid> --apply]");
  process.exitCode = 2;
} else if (!isAbsolute(databaseArgument)) {
  throw new Error("SOURCE_EDITORIAL_ALIAS_ABSOLUTE_DATABASE_PATH_REQUIRED");
} else if (operation === "associate" && !flags.has("--apply")) {
  parseEditorialSourceAlias(editorialAlias);
  console.log(JSON.stringify({ status: "VALIDATED_NOT_ASSOCIATED", editorialAlias }));
} else {
  const databasePath = resolve(databaseArgument);
  if (!existsSync(databasePath)) throw new AppError({ code: "SOURCE_EDITORIAL_ALIAS_DATABASE_NOT_FOUND", userMessage: "La base indiquée est introuvable.", category: "database" });
  const sqlite = new DatabaseSync(databasePath, { readOnly: operation === "resolve" });
  try {
    sqlite.exec("PRAGMA foreign_keys=ON");
    const database: SqliteExecutor = { all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) };
    const version = new SqliteMigrationHistoryStore(database).list().at(-1)?.toVersion ?? null;
    if (!isSourceVersionAliasSchemaSupported(version)) throw new AppError({ code: "SOURCE_EDITORIAL_ALIAS_SCHEMA_VERSION_REQUIRED", userMessage: `Un schéma compris entre 15 et ${MAX_SUPPORTED_SCHEMA_VERSION} est requis.`, category: "database" });
    const repository = new SqliteSourceVersionEditorialAliasRepository(database);
    if (operation === "resolve") {
      const result = await new ResolveSourceVersionEditorialAlias(repository).execute({ editorialAlias });
      console.log(JSON.stringify({ status: "RESOLVED", editorialAlias: result.editorialAlias, sourceVersionId: result.sourceVersionId, traceId: result.traceId }));
    } else {
      const sourceVersionId = values.get("--source-version-id");
      const actorId = values.get("--actor-id");
      const traceId = values.get("--trace-id") ?? randomUUID();
      if (!sourceVersionId || !actorId) throw new AppError({ code: "SOURCE_EDITORIAL_ALIAS_INPUT_INVALID", userMessage: "source-version-id et actor-id sont requis.", category: "validation" });
      const result = await new AssociateSourceVersionEditorialAlias(repository, { generate: randomUUID }, { now: () => new Date().toISOString() }).execute({ editorialAlias, sourceVersionId, actorId, traceId });
      console.log(JSON.stringify({ status: result.status, editorialAlias: result.association.editorialAlias, sourceVersionId: result.association.sourceVersionId, traceId: result.association.traceId }));
    }
  } catch (error) {
    if (error instanceof AppError) console.error(JSON.stringify({ status: "ERROR", code: error.code, message: error.userMessage }));
    else throw error;
    process.exitCode = 1;
  } finally {
    sqlite.close();
  }
}
