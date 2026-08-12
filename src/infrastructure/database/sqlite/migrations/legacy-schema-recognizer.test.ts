import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SqliteExecutor } from "../sqlite-executor";
import { CORE_BASELINE_STATEMENTS } from "./definitions/mig-0001-core-baseline";
import {
  LEGACY_CORE_9,
  LEGACY_CORE_9_WITH_IMPORT_JOURNAL,
} from "./legacy-schema-fingerprints";
import { LegacySchemaRecognizer } from "./legacy-schema-recognizer";
import { SqliteSchemaInspector } from "./sqlite-schema-inspector";

const JOURNAL_SQL = `CREATE TABLE document_import_journal (
  storage_id TEXT PRIMARY KEY,
  extension TEXT NOT NULL,
  display_name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  subject TEXT NOT NULL,
  document_status TEXT NOT NULL,
  content TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','ready','missing')),
  created_at INTEGER NOT NULL,
  document_id INTEGER
)`;

describe("LegacySchemaRecognizer with isolated schemas", () => {
  let sqlite: DatabaseSync;
  let executor: SqliteExecutor;
  let inspector: SqliteSchemaInspector;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    executor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
    };
    inspector = new SqliteSchemaInspector(executor);
  });
  afterEach(() => sqlite.close());

  function core(): void {
    for (const statement of CORE_BASELINE_STATEMENTS) sqlite.exec(statement);
  }

  it("recognizes the exact core-9 legacy schema deterministically", () => {
    core();
    const recognizer = new LegacySchemaRecognizer();
    const first = recognizer.recognize(inspector.inspect());

    expect(first).toMatchObject({
      state: "RECOGNIZED_LEGACY",
      matchType: "EXACT_MATCH",
      fingerprint: { id: "LEGACY_CORE_9" },
    });
    expect(recognizer.recognize(inspector.inspect())).toEqual(first);
  });

  it("recognizes the approved import-journal variant", () => {
    core();
    sqlite.exec(JOURNAL_SQL);
    expect(new LegacySchemaRecognizer().recognize(inspector.inspect())).toMatchObject({
      state: "RECOGNIZED_LEGACY",
      fingerprint: { id: "LEGACY_CORE_9_WITH_IMPORT_JOURNAL" },
    });
  });

  it.each([
    ["missing table", "DROP TABLE weaknesses"],
    ["missing column", "ALTER TABLE documents DROP COLUMN archived"],
    ["incompatible primary key", "ALTER TABLE settings RENAME TO old_settings; CREATE TABLE settings(key TEXT,value TEXT NOT NULL); DROP TABLE old_settings"],
    ["unexpected business table", "CREATE TABLE unexplained(id INTEGER)"],
  ])("reports a partial match for %s", (_label, mutation) => {
    core();
    sqlite.exec(mutation);
    expect(new LegacySchemaRecognizer().recognize(inspector.inspect()).state).toBe("PARTIAL_LEGACY");
  });

  it("ignores irrelevant SQLite-owned tables", () => {
    core();
    expect(inspector.inspect().tables.some(({ name }) => name === "sqlite_sequence")).toBe(true);
    expect(new LegacySchemaRecognizer().recognize(inspector.inspect())).toMatchObject({
      state: "RECOGNIZED_LEGACY",
      fingerprint: { id: "LEGACY_CORE_9" },
    });
  });

  it("does not depend on snapshot collection order", () => {
    core();
    const snapshot = inspector.inspect();
    const shuffled = {
      ...snapshot,
      tables: [...snapshot.tables].reverse(),
      views: [...snapshot.views].reverse(),
      triggers: [...snapshot.triggers].reverse(),
    };
    expect(new LegacySchemaRecognizer().recognize(shuffled)).toMatchObject({
      state: "RECOGNIZED_LEGACY",
      fingerprint: { id: "LEGACY_CORE_9" },
    });
  });

  it("fails closed when two fingerprints match", () => {
    core();
    const duplicate = { ...LEGACY_CORE_9, id: "LEGACY_CORE_9_DUPLICATE" };
    expect(
      new LegacySchemaRecognizer([LEGACY_CORE_9, duplicate]).recognize(inspector.inspect()),
    ).toMatchObject({
      state: "AMBIGUOUS_LEGACY",
      candidateFingerprintIds: ["LEGACY_CORE_9", "LEGACY_CORE_9_DUPLICATE"],
    });
  });

  it("reports unknown schemas without reading rows", () => {
    sqlite.exec("CREATE TABLE unrelated(payload BLOB)");
    expect(new LegacySchemaRecognizer().recognize(inspector.inspect()).state).toBe("UNKNOWN_LEGACY");
  });

  it("keeps the two approved fingerprints structurally distinct", () => {
    expect(LEGACY_CORE_9_WITH_IMPORT_JOURNAL.tables).toHaveLength(10);
    expect(LEGACY_CORE_9.tables).toHaveLength(9);
  });
});
