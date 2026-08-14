import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  INITIAL_FOUNDATION_CURRICULUM,
  INITIAL_FOUNDATION_CURRICULUM_ID,
  seedInitialFoundationCurriculum,
} from "@/application/foundation/foundation-curriculum-seed";
import { publishCurriculumVersion } from "@/domain/foundation";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { FreshDatabaseBootstrap } from "@/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import { SqliteFoundationRepository } from "./sqlite-foundation-repository";

const setup = () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  const database: SqliteExecutor = {
    all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
    run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
  };
  new FreshDatabaseBootstrap(database).run();
  return { sqlite, repository: new SqliteFoundationRepository(database) };
};

describe("initial Foundation curriculum seed", () => {
  it("creates one unpublished draft with exactly six canonical blocks", async () => {
    const { sqlite, repository } = setup();
    const result = await seedInitialFoundationCurriculum(repository);
    const persisted = await repository.findVersion(INITIAL_FOUNDATION_CURRICULUM_ID);

    expect(result.status).toBe("CREATED");
    expect(persisted?.version).toMatchObject({ version: 1, status: "DRAFT", publishedAt: null });
    expect(persisted?.blocks).toHaveLength(6);
    expect(persisted?.blocks.map(({ code }) => code)).toEqual(["BIO", "PHA", "CALC", "THER", "CAN", "COMM"]);
    expect(persisted?.blocks.map(({ position }) => position)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(persisted?.blocks.every(({ isRequired }) => isRequired)).toBe(true);
    expect(persisted?.units).toHaveLength(6);
    expect(persisted?.units.every(({ status }) => status === "DRAFT")).toBe(true);
    expect(persisted?.objectives).toHaveLength(6);
    expect(persisted?.objectives.every(({ objectiveType }) => objectiveType === "TECHNICAL_SEED")).toBe(true);
    sqlite.close();
  });

  it("is idempotent and preserves stable identities", async () => {
    const { sqlite, repository } = setup();
    const first = await seedInitialFoundationCurriculum(repository);
    const second = await seedInitialFoundationCurriculum(repository);

    expect(first.status).toBe("CREATED");
    expect(second.status).toBe("ALREADY_PRESENT");
    expect(second.curriculum).toEqual(first.curriculum);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM curriculum_versions").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM curriculum_blocks").get()).toEqual({ count: 6 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM curriculum_units").get()).toEqual({ count: 6 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM learning_objectives").get()).toEqual({ count: 6 });
    sqlite.close();
  });

  it("does not rewrite an existing published curriculum", async () => {
    const { sqlite, repository } = setup();
    const published = Object.freeze({
      ...INITIAL_FOUNDATION_CURRICULUM,
      version: publishCurriculumVersion(INITIAL_FOUNDATION_CURRICULUM.version, "2026-08-14T01:00:00.000Z"),
    });
    await repository.save(published);

    const result = await seedInitialFoundationCurriculum(repository);
    expect(result.status).toBe("ALREADY_PRESENT");
    expect(result.curriculum).toEqual(published);
    expect((await repository.findVersion(INITIAL_FOUNDATION_CURRICULUM_ID))?.version.status).toBe("PUBLISHED");
    sqlite.close();
  });
});
