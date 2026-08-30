import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { parseMcqCorpus } from "../src/application/mcq/mcq-corpus-contract";
import { ImportMcqCorpus } from "../src/application/mcq/import-mcq-corpus";
import { SqliteMcqCorpusWriter } from "../src/infrastructure/mcq/sqlite-mcq-corpus-writer";
import type { SqliteExecutor } from "../src/infrastructure/database/sqlite/sqlite-executor";

const args = new Map(process.argv.slice(2).map(value => { const [key, ...rest] = value.split("="); return [key, rest.join("=")]; }));
const databaseArgument = args.get("--database");
const corpusArgument = args.get("--corpus");
const apply = args.has("--apply");

if (!databaseArgument || !corpusArgument) {
  console.error("Usage: pnpm mcq:import -- --database=<absolute-path> --corpus=<absolute-path> [--apply]");
  process.exitCode = 2;
} else {
  if (!isAbsolute(databaseArgument) || !isAbsolute(corpusArgument)) {
    throw new Error("MCQ_IMPORT_ABSOLUTE_PATHS_REQUIRED");
  }
  const databasePath = resolve(databaseArgument);
  const corpusPath = resolve(corpusArgument);
  const corpus = parseMcqCorpus(JSON.parse(await readFile(corpusPath, "utf8")) as unknown);
  if (!apply) {
    console.log(JSON.stringify({ status: "VALIDATED_NOT_IMPORTED", schemaVersion: corpus.schemaVersion, corpusId: corpus.corpusId, corpusVersion: corpus.corpusVersion, itemCount: corpus.items.length }));
  } else {
    const sqlite = new DatabaseSync(databasePath);
    try {
      const version = sqlite.prepare("SELECT MAX(to_version) AS version FROM schema_migrations").get() as { version: number | null };
      if (version.version !== 14 && version.version !== 15) throw new Error(`MCQ_IMPORT_SCHEMA_VERSION_REQUIRED:14_OR_15:actual=${version.version ?? "none"}`);
      sqlite.exec("PRAGMA foreign_keys=ON");
      const executor: SqliteExecutor = {
        all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
        run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
      };
      const result = await new ImportMcqCorpus(new SqliteMcqCorpusWriter(executor), { checksum: value => createHash("sha256").update(value).digest("hex") }, { now: () => new Date().toISOString() }).execute(corpus);
      console.log(JSON.stringify({ status: "IMPORTED", corpusId: corpus.corpusId, corpusVersion: corpus.corpusVersion, ...result }));
    } finally {
      sqlite.close();
    }
  }
}
