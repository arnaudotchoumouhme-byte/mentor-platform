import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SqliteExecutor } from "../sqlite-executor";
import { SqliteMigrationHistoryStore } from "./sqlite-migration-history-store";
import { SqliteSchemaInspector } from "./sqlite-schema-inspector";

describe("SqliteSchemaInspector with an isolated in-memory database", () => {
  let sqlite: DatabaseSync;
  let inspector: SqliteSchemaInspector;
  let executor: SqliteExecutor;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    executor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) =>
        sqlite.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) =>
        sqlite.prepare(sql).run(...params),
    };
    inspector = new SqliteSchemaInspector(executor);
  });

  afterEach(() => sqlite.close());

  it("returns an immutable empty deterministic snapshot", () => {
    const first = inspector.inspect();

    expect(first).toEqual({ tables: [], views: [], triggers: [] });
    expect(inspector.inspect()).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.tables)).toBe(true);
  });

  it("describes columns, primary keys, indexes and foreign keys", () => {
    sqlite.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE parents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE
      );
      CREATE TABLE children (
        id INTEGER PRIMARY KEY,
        parent_id INTEGER NOT NULL,
        label TEXT DEFAULT 'new',
        FOREIGN KEY(parent_id) REFERENCES parents(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_children_label ON children(label DESC);
    `);

    const snapshot = inspector.inspect();
    const children = snapshot.tables.find(({ name }) => name === "children");
    const parents = snapshot.tables.find(({ name }) => name === "parents");

    expect(snapshot.tables.map(({ name }) => name)).toEqual([
      "children",
      "parents",
      "sqlite_sequence",
    ]);
    expect(children?.columns).toEqual([
      {
        position: 0,
        name: "id",
        declaredType: "INTEGER",
        nullable: true,
        defaultValue: null,
        primaryKeyPosition: 1,
        hidden: 0,
      },
      {
        position: 1,
        name: "parent_id",
        declaredType: "INTEGER",
        nullable: false,
        defaultValue: null,
        primaryKeyPosition: 0,
        hidden: 0,
      },
      {
        position: 2,
        name: "label",
        declaredType: "TEXT",
        nullable: true,
        defaultValue: "'new'",
        primaryKeyPosition: 0,
        hidden: 0,
      },
    ]);
    expect(children?.foreignKeys).toEqual([
      {
        id: 0,
        sequence: 0,
        targetTable: "parents",
        fromColumn: "parent_id",
        toColumn: "id",
        onUpdate: "NO ACTION",
        onDelete: "CASCADE",
        match: "NONE",
      },
    ]);
    expect(children?.definitionSql).toContain(
      "FOREIGN KEY(parent_id) REFERENCES parents(id) ON DELETE CASCADE",
    );
    expect(children?.indexes[0]).toMatchObject({
      name: "idx_children_label",
      unique: false,
      origin: "c",
      partial: false,
    });
    expect(children?.indexes[0]?.columns[0]).toMatchObject({
      name: "label",
      descending: true,
      key: true,
    });
    expect(parents?.indexes.some((index) => index.unique)).toBe(true);
    expect(snapshot.tables.find(({ name }) => name === "sqlite_sequence")?.kind).toBe(
      "SQLITE_INTERNAL",
    );
  });

  it("detects views, triggers and virtual tables in stable order", () => {
    sqlite.exec(`
      CREATE TABLE source (id INTEGER PRIMARY KEY, value TEXT);
      CREATE VIEW z_view AS SELECT id,value FROM source;
      CREATE VIEW a_view AS SELECT id FROM source;
      CREATE TRIGGER z_trigger AFTER INSERT ON source BEGIN UPDATE source SET value=NEW.value WHERE id=NEW.id; END;
      CREATE TRIGGER a_trigger AFTER DELETE ON source BEGIN SELECT 1; END;
      CREATE VIRTUAL TABLE searchable USING fts5(content);
    `);

    const snapshot = inspector.inspect();

    expect(snapshot.views.map(({ name }) => name)).toEqual(["a_view", "z_view"]);
    expect(snapshot.triggers.map(({ name }) => name)).toEqual(["a_trigger", "z_trigger"]);
    expect(snapshot.tables.find(({ name }) => name === "searchable")?.virtual).toBe(true);
    expect(inspector.inspect()).toEqual(snapshot);
  });

  it("classifies migration history separately from application tables", () => {
    new SqliteMigrationHistoryStore(executor).ensureStorage();

    expect(inspector.inspect().tables).toEqual([
      expect.objectContaining({
        name: "schema_migrations",
        kind: "MIGRATION_METADATA_TABLE",
      }),
    ]);
  });

  it("wraps metadata failures without leaking the original content", () => {
    const failing = new SqliteSchemaInspector({
      all: () => {
        throw new Error("private database path and content");
      },
      run: () => ({ changes: 0 }),
    });

    expect(() => failing.inspect()).toThrow("Unable to inspect SQLite schema metadata.");
  });
});
