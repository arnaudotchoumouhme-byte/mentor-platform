import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  INITIAL_FOUNDATION_CURRICULUM,
  seedInitialFoundationCurriculum,
} from "./foundation-curriculum-seed";
import {
  CompleteDiagnostic,
  EstimateMastery,
  RecommendFoundationPath,
  RecordObservation,
  StartDiagnostic,
} from "./foundation-diagnostic-use-cases";
import type {
  FoundationClock,
  FoundationDiagnosticPolicy,
  FoundationIdGenerator,
} from "./foundation-ports";
import type { MasteryLevel, RecommendationDecision } from "@/domain/foundation";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { FreshDatabaseBootstrap } from "@/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import { SqliteFoundationRepository } from "@/infrastructure/foundation/sqlite-foundation-repository";

const learnerId = "b0000000-0000-4000-8000-000000000001";
class TestIds implements FoundationIdGenerator {
  private value = 0;
  next(): string { this.value += 1; return `a0000000-0000-4000-8000-${String(this.value).padStart(12, "0")}`; }
}
class TestClock implements FoundationClock {
  value = "2026-08-14T01:00:00.000Z";
  now(): string { return this.value; }
}
class TestPolicy implements FoundationDiagnosticPolicy {
  readonly ruleVersion = "synthetic-policy-v1";
  level: MasteryLevel = "N2";
  confidence = 0.75;
  decision: RecommendationDecision = "RECOMMENDED";
  estimate() { return { level: this.level, confidence: this.confidence }; }
  recommend() {
    return { decision: this.decision, justification: `Synthetic ${this.decision} recommendation.` };
  }
}

const setup = async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  const database: SqliteExecutor = {
    all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[],
    run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
  };
  new FreshDatabaseBootstrap(database).run();
  const repository = new SqliteFoundationRepository(database);
  await seedInitialFoundationCurriculum(repository);
  const ids = new TestIds();
  const clock = new TestClock();
  const policy = new TestPolicy();
  return { sqlite, repository, ids, clock, policy };
};

const start = async (context: Awaited<ReturnType<typeof setup>>, targetBlockIds = [INITIAL_FOUNDATION_CURRICULUM.blocks[0]!.id]) =>
  new StartDiagnostic(context.repository, context.repository, context.ids, context.clock).execute({
    learnerId,
    curriculumVersionId: INITIAL_FOUNDATION_CURRICULUM.version.id,
    targetBlockIds,
    expectedCount: null,
  });

const record = async (context: Awaited<ReturnType<typeof setup>>, diagnosticId: string, overrides: Partial<Parameters<RecordObservation["execute"]>[0]> = {}) => {
  const block = INITIAL_FOUNDATION_CURRICULUM.blocks[0]!;
  const unit = INITIAL_FOUNDATION_CURRICULUM.units[0]!;
  const objective = INITIAL_FOUNDATION_CURRICULUM.objectives[0]!;
  return new RecordObservation(context.repository, context.repository, context.ids, context.clock).execute({
    diagnosticId,
    blockId: block.id,
    unitId: unit.id,
    objectiveId: objective.id,
    activityType: "SYNTHETIC_CHECK",
    outcome: { observed: true },
    confidence: 0.8,
    durationMs: 1000,
    criticalErrorCategory: null,
    evidenceType: "FOUNDATION",
    evidenceRefId: null,
    evidenceRefVersion: null,
    ...overrides,
  });
};

describe("Foundation diagnostic use cases", () => {
  it("starts a valid diagnostic and rejects empty, unknown and out-of-version scopes", async () => {
    const context = await setup();
    const diagnostic = await start(context);
    expect(diagnostic).toMatchObject({ status: "IN_PROGRESS", learnerId, observedCount: 0 });
    await expect(start(context, [])).rejects.toMatchObject({ code: "FOUNDATION_DIAGNOSTIC_INVALID" });
    await expect(new StartDiagnostic(context.repository, context.repository, context.ids, context.clock).execute({ learnerId, curriculumVersionId: "c0000000-0000-4000-8000-000000000001", targetBlockIds: [INITIAL_FOUNDATION_CURRICULUM.blocks[0]!.id], expectedCount: null })).rejects.toMatchObject({ code: "FOUNDATION_DIAGNOSTIC_INVALID" });
    await expect(start(context, ["c0000000-0000-4000-8000-000000000002"])).rejects.toMatchObject({ code: "FOUNDATION_DIAGNOSTIC_INVALID" });
    context.sqlite.close();
  });

  it("records observations with coherent hierarchy and monotonic progress", async () => {
    const context = await setup();
    const diagnostic = await start(context);
    const once = await record(context, diagnostic.id);
    const twice = await record(context, diagnostic.id);
    expect(once.observedCount).toBe(1);
    expect(twice.observedCount).toBe(2);
    expect((await context.repository.findDiagnostic(diagnostic.id))?.observations).toHaveLength(2);
    await expect(record(context, diagnostic.id, { unitId: INITIAL_FOUNDATION_CURRICULUM.units[1]!.id })).rejects.toMatchObject({ code: "FOUNDATION_OBSERVATION_INVALID" });
    await expect(record(context, diagnostic.id, { confidence: 2 })).rejects.toMatchObject({ code: "FOUNDATION_OBSERVATION_INVALID" });
    context.sqlite.close();
  });

  it("completes persistently, handles a second completion and rejects later observations", async () => {
    const context = await setup();
    const diagnostic = await start(context);
    await record(context, diagnostic.id);
    context.clock.value = "2026-08-14T02:00:00.000Z";
    const useCase = new CompleteDiagnostic(context.repository, context.clock);
    const completed = await useCase.execute(diagnostic.id);
    expect(completed.status).toBe("COMPLETED");
    expect(await useCase.execute(diagnostic.id)).toEqual(completed);
    await expect(record(context, diagnostic.id)).rejects.toMatchObject({ code: "FOUNDATION_DIAGNOSTIC_CLOSED" });
    expect((await context.repository.findDiagnostic(diagnostic.id))?.status).toBe("COMPLETED");
    context.sqlite.close();
  });

  it("estimates N0 without evidence and appends N1 through N4 with evidence and rule version", async () => {
    const context = await setup();
    const diagnostic = await start(context);
    const block = INITIAL_FOUNDATION_CURRICULUM.blocks[0]!;
    const estimator = new EstimateMastery(context.repository, context.repository, context.policy, context.ids, context.clock);
    context.policy.level = "N0";
    const n0 = await estimator.execute({ diagnosticId: diagnostic.id, blockId: block.id, unitId: null, objectiveId: null });
    expect(n0).toMatchObject({ level: "N0", confidence: 0.75, ruleVersion: "synthetic-policy-v1", evidenceObservationIds: [] });
    await record(context, diagnostic.id);
    for (const level of ["N1", "N2", "N3", "N4"] as const) {
      context.policy.level = level;
      const estimate = await estimator.execute({ diagnosticId: diagnostic.id, blockId: block.id, unitId: null, objectiveId: null });
      expect(estimate.level).toBe(level);
      expect(estimate.evidenceObservationIds).toHaveLength(1);
    }
    expect(await context.repository.listMasteryEstimates(learnerId)).toHaveLength(5);
    context.sqlite.close();
  });

  it("produces traceable REQUIRED, RECOMMENDED and EXEMPTED recommendations with supersession", async () => {
    const context = await setup();
    const diagnostic = await start(context);
    await record(context, diagnostic.id);
    const block = INITIAL_FOUNDATION_CURRICULUM.blocks[0]!;
    const mastery = await new EstimateMastery(context.repository, context.repository, context.policy, context.ids, context.clock).execute({ diagnosticId: diagnostic.id, blockId: block.id, unitId: null, objectiveId: null });
    const recommender = new RecommendFoundationPath(context.repository, context.policy, context.ids, context.clock);
    let supersedesId: string | null = null;
    for (const decision of ["REQUIRED", "RECOMMENDED", "EXEMPTED"] as const) {
      context.policy.decision = decision;
      const recommendation = await recommender.execute({ diagnosticId: diagnostic.id, mastery, supersedesId });
      expect(recommendation).toMatchObject({ decision, supersedesId, ruleVersion: "synthetic-policy-v1" });
      expect(recommendation.evidenceObservationIds).toHaveLength(1);
      expect(recommendation.justification).toContain("Synthetic");
      supersedesId = recommendation.id;
    }
    expect(await context.repository.listRecommendations(learnerId)).toHaveLength(3);
    context.sqlite.close();
  });

  it("blocks a positive recommendation when unresolved critical evidence exists", async () => {
    const context = await setup();
    const diagnostic = await start(context);
    await record(context, diagnostic.id, { criticalErrorCategory: "SAFETY" });
    const block = INITIAL_FOUNDATION_CURRICULUM.blocks[0]!;
    const mastery = await new EstimateMastery(context.repository, context.repository, context.policy, context.ids, context.clock).execute({ diagnosticId: diagnostic.id, blockId: block.id, unitId: null, objectiveId: null });
    context.policy.decision = "EXEMPTED";
    const recommendation = await new RecommendFoundationPath(context.repository, context.policy, context.ids, context.clock).execute({ diagnosticId: diagnostic.id, mastery, supersedesId: null });
    expect(recommendation.decision).toBe("REQUIRED");
    expect(recommendation.justification).toContain("critical");
    context.sqlite.close();
  });

  it("refuses an exemption without observation evidence", async () => {
    const context = await setup();
    const diagnostic = await start(context);
    const block = INITIAL_FOUNDATION_CURRICULUM.blocks[0]!;
    context.policy.level = "N0";
    const mastery = await new EstimateMastery(context.repository, context.repository, context.policy, context.ids, context.clock).execute({ diagnosticId: diagnostic.id, blockId: block.id, unitId: null, objectiveId: null });
    context.policy.decision = "EXEMPTED";
    await expect(new RecommendFoundationPath(context.repository, context.policy, context.ids, context.clock).execute({ diagnosticId: diagnostic.id, mastery, supersedesId: null })).rejects.toMatchObject({ code: "FOUNDATION_RECOMMENDATION_INVALID" });
    context.sqlite.close();
  });
});
