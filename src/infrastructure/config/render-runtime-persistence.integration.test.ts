import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FreshDatabaseBootstrap } from "@/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("Render-like durable SQLite runtime", () => {
  it("preserves data when a process reopens the same explicit persistent path", async () => {
    const mount = await mkdtemp(path.join(os.tmpdir(), "mentor-render-durable-"));
    roots.push(mount);
    const databasePath = path.join(mount, "data", "mentor.db");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(databasePath), { recursive: true }));

    const first = new DatabaseSync(databasePath);
    const executor: SqliteExecutor = {
      all: <T>(sql: string, ...params: SQLInputValue[]) => first.prepare(sql).all(...params) as T[],
      run: (sql: string, ...params: SQLInputValue[]) => first.prepare(sql).run(...params),
    };
    new FreshDatabaseBootstrap(executor).run();
    first.prepare("INSERT INTO subjects(name,color,mastery) VALUES(?,?,?)")
      .run("DEV007-PERSISTENCE", "#123456", 42);
    first.close();

    const restarted = new DatabaseSync(databasePath, { readOnly: true });
    expect(restarted.prepare("SELECT name,mastery FROM subjects WHERE name=?")
      .get("DEV007-PERSISTENCE")).toEqual({ name: "DEV007-PERSISTENCE", mastery: 42 });
    expect(restarted.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    restarted.close();
  });
});
