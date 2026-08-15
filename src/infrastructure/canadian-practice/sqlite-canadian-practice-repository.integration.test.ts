import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { FreshDatabaseBootstrap } from "@/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import { SqliteFoundationRepository } from "@/infrastructure/foundation/sqlite-foundation-repository";
import { INITIAL_FOUNDATION_CURRICULUM, seedInitialFoundationCurriculum } from "@/application/foundation/foundation-curriculum-seed";
import { SqliteCanadianPracticeRepository } from "./sqlite-canadian-practice-repository";

const ids = { rule: "10000000-0000-4000-8000-000000000001", version1: "20000000-0000-4000-8000-000000000001", version2: "20000000-0000-4000-8000-000000000002", source: "30000000-0000-4000-8000-000000000001", sourceVersion: "40000000-0000-4000-8000-000000000001" };
const makeVersion = (id: string, ruleVersion: number, effectiveFrom: string, effectiveTo: string | null = null) => ({ id, practiceRuleId: ids.rule, ruleVersion, jurisdiction: "PROVINCIAL" as const, province: "ON" as const, sourceVersionId: ids.sourceVersion, verifiedAt: "2026-08-14T00:00:00.000Z", effectiveFrom, effectiveTo, status: "ACTIVE" as const, pedagogicalSummary: "TEST_FIXTURE summary", independenceDisclaimer: "TEST_FIXTURE — not official guidance.", createdAt: "2026-08-14T00:00:00.000Z" });

const setup = async () => {
  const sqlite = new DatabaseSync(":memory:"); sqlite.exec("PRAGMA foreign_keys=ON");
  const db: SqliteExecutor = { all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) };
  new FreshDatabaseBootstrap(db).run();
  await seedInitialFoundationCurriculum(new SqliteFoundationRepository(db));
  sqlite.prepare("INSERT INTO documents(name,type) VALUES('TEST_FIXTURE','txt')").run();
  sqlite.prepare("INSERT INTO sources(source_id,storage_id,document_id,original_filename,display_name,media_type,extension,size_bytes,checksum,status,extraction_status,provenance_type) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(ids.source,"fixture",1,"fixture.txt","TEST_FIXTURE","text/plain","txt",1,"checksum","READY","COMPLETED","TEST_FIXTURE");
  sqlite.prepare("INSERT INTO source_versions(source_version_id,source_id,version,checksum,extraction_status) VALUES(?,?,?,?,?)").run(ids.sourceVersion,ids.source,1,"checksum","COMPLETED");
  return { sqlite, repository: new SqliteCanadianPracticeRepository(db) };
};

describe("SqliteCanadianPracticeRepository", () => {
  it("inserts a CAN rule and immutable history, then resolves by effective date", async () => {
    const { sqlite, repository } = await setup();
    const canObjective = INITIAL_FOUNDATION_CURRICULUM.objectives[4]!.id;
    await repository.insertRule({ practiceRuleId: ids.rule, code: "TEST_FIXTURE_ON", learningObjectiveId: canObjective });
    await repository.insertRuleVersion(makeVersion(ids.version1, 1, "2026-01-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z"));
    await repository.insertRuleVersion(makeVersion(ids.version2, 2, "2027-01-01T00:00:00.000Z"));
    expect((await repository.findRule(ids.rule))?.code).toBe("TEST_FIXTURE_ON");
    expect((await repository.findVersion(ids.rule, 1))?.id).toBe(ids.version1);
    expect((await repository.listHistory(ids.rule)).map(({ ruleVersion }) => ruleVersion)).toEqual([1, 2]);
    expect((await repository.resolveActive({ practiceRuleId: ids.rule, jurisdiction: "PROVINCIAL", province: "ON", at: "2026-06-01T00:00:00.000Z" }))?.ruleVersion).toBe(1);
    expect((await repository.resolveActive({ practiceRuleId: ids.rule, jurisdiction: "PROVINCIAL", province: "ON", at: "2027-06-01T00:00:00.000Z" }))?.ruleVersion).toBe(2);
    await expect(repository.insertRuleVersion(makeVersion("20000000-0000-4000-8000-000000000003", 2, "2028-01-01T00:00:00.000Z"))).rejects.toThrow();
    sqlite.close();
  });
  it("enforces Foundation CAN and SourceVersion foreign keys", async () => {
    const { sqlite, repository } = await setup();
    await expect(repository.insertRule({ practiceRuleId: ids.rule, code: "TEST_FIXTURE_BAD", learningObjectiveId: INITIAL_FOUNDATION_CURRICULUM.objectives[0]!.id })).rejects.toThrow(/CAN block/);
    await repository.insertRule({ practiceRuleId: ids.rule, code: "TEST_FIXTURE_ON", learningObjectiveId: INITIAL_FOUNDATION_CURRICULUM.objectives[4]!.id });
    await expect(repository.insertRuleVersion({ ...makeVersion(ids.version1, 1, "2026-01-01T00:00:00.000Z"), sourceVersionId: "50000000-0000-4000-8000-000000000001" })).rejects.toThrow();
    sqlite.close();
  });
});
