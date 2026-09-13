import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPilotCatalog } from "../src/application/mle/pilot-catalog";
import { SaveDraftCatalog, ReadCatalog } from "../src/application/mle/catalog-use-cases";
import { SqliteCatalogRepository } from "../src/infrastructure/mle/sqlite-catalog-repository";
import { SqliteNativeCatalogResources } from "../src/infrastructure/mle/sqlite-native-resources";
import { FreshDatabaseBootstrap } from "../src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import type { SqliteExecutor } from "../src/infrastructure/database/sqlite/sqlite-executor";

// Intentionally accepts no target database: this preview can never migrate an existing database.
if (process.argv.length > 2) throw new Error("Preview accepts no arguments and only creates a new synthetic database.");
const directory = mkdtempSync(path.join(tmpdir(), "mentor-mle-01-preview-"));
const databasePath = path.join(directory, "synthetic.sqlite");
const sqlite = new DatabaseSync(databasePath);
try {
  sqlite.exec("PRAGMA foreign_keys=ON");
  const database: SqliteExecutor = {
    all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
    run: (sql, ...params) => sqlite.prepare(sql).run(...params),
  };
  new FreshDatabaseBootstrap(database).run();
  const repository = new SqliteCatalogRepository(database);
  new SaveDraftCatalog(repository, new SqliteNativeCatalogResources(database)).execute(createPilotCatalog());
  console.log(JSON.stringify({ databasePath, catalog: new ReadCatalog(repository).execute() }, null, 2));
} finally { sqlite.close(); }
