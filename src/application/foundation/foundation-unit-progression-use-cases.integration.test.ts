import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { INITIAL_FOUNDATION_CURRICULUM, seedInitialFoundationCurriculum } from "./foundation-curriculum-seed";
import { RecordObservation, StartDiagnostic } from "./foundation-diagnostic-use-cases";
import type { FoundationClock, FoundationIdGenerator, FoundationProgressPolicy } from "./foundation-ports";
import {
  AdvanceUnit,
  CompleteExitAssessment,
  RecordRetest,
  ResolveCriticalError,
  ResumeUnitProgress,
  StartUnitProgress,
} from "./foundation-unit-progression-use-cases";
import { FOUNDATION_UNIT_STAGES, type DiagnosticObservation } from "@/domain/foundation";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { FreshDatabaseBootstrap } from "@/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import { SqliteFoundationRepository } from "@/infrastructure/foundation/sqlite-foundation-repository";

const learnerId = "d0000000-0000-4000-8000-000000000001";
class TestIds implements FoundationIdGenerator {
  private value = 0;
  next(): string { this.value += 1; return `e0000000-0000-4000-8000-${String(this.value).padStart(12, "0")}`; }
}
class TestClock implements FoundationClock {
  private minute = 0;
  now(): string { this.minute += 1; return `2026-08-14T03:${String(this.minute).padStart(2, "0")}:00.000Z`; }
}
class TestPolicy implements FoundationProgressPolicy {
  readonly ruleVersion = "synthetic-progress-v1";
  decideExit() { return "READY_FOR_MCQ" as const; }
  isRetestSatisfactory(observation: DiagnosticObservation) { return observation.outcome.satisfactory === true; }
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
  return { sqlite, repository, ids: new TestIds(), clock: new TestClock(), policy: new TestPolicy() };
};

const unit = INITIAL_FOUNDATION_CURRICULUM.units[0]!;
const block = INITIAL_FOUNDATION_CURRICULUM.blocks[0]!;
const objective = INITIAL_FOUNDATION_CURRICULUM.objectives[0]!;
const progressInput = { learnerId, curriculumVersionId: INITIAL_FOUNDATION_CURRICULUM.version.id, unitId: unit.id };

const startDiagnosticWithObservation = async (context: Awaited<ReturnType<typeof setup>>, critical = false) => {
  const diagnostic = await new StartDiagnostic(context.repository, context.repository, context.ids, context.clock).execute({ learnerId, curriculumVersionId: INITIAL_FOUNDATION_CURRICULUM.version.id, targetBlockIds: [block.id], expectedCount: null });
  const updated = await new RecordObservation(context.repository, context.repository, context.ids, context.clock).execute({ diagnosticId: diagnostic.id, blockId: block.id, unitId: unit.id, objectiveId: objective.id, activityType: "APPLICATION", outcome: { satisfactory: !critical }, confidence: 0.8, durationMs: 1000, criticalErrorCategory: critical ? "SAFETY" : null, evidenceType: "FOUNDATION", evidenceRefId: null, evidenceRefVersion: null });
  return { diagnostic: updated, observation: updated.observations[0]! };
};

describe("Foundation unit progression use cases", () => {
  it("starts at PRE_TEST, rejects an unknown unit and is idempotent for an active duplicate", async () => {
    const context = await setup();
    const useCase = new StartUnitProgress(context.repository, context.repository, context.ids, context.clock);
    const first = await useCase.execute(progressInput);
    const second = await useCase.execute(progressInput);
    expect(first.currentStage).toBe("PRE_TEST");
    expect(second).toEqual(first);
    expect(context.sqlite.prepare("SELECT COUNT(*) AS count FROM foundation_unit_progress").get()).toEqual({ count: 1 });
    await expect(useCase.execute({ ...progressInput, unitId: "d0000000-0000-4000-8000-000000000009" })).rejects.toMatchObject({ code: "FOUNDATION_PROGRESS_INVALID_TRANSITION" });
    context.sqlite.close();
  });

  it("advances through all eight stages, rejects skips and preserves monotone timestamps", async () => {
    const context = await setup();
    let progress = await new StartUnitProgress(context.repository, context.repository, context.ids, context.clock).execute(progressInput);
    const advance = new AdvanceUnit(context.repository, context.clock);
    await expect(advance.execute({ progressId: progress.id, targetStage: "APPLICATION" })).rejects.toMatchObject({ code: "FOUNDATION_PROGRESS_INVALID_TRANSITION" });
    for (const stage of FOUNDATION_UNIT_STAGES.slice(1)) {
      const previous = progress.updatedAt;
      progress = await advance.execute({ progressId: progress.id, targetStage: stage });
      expect(Date.parse(progress.updatedAt)).toBeGreaterThanOrEqual(Date.parse(previous));
      expect(progress.currentStage).toBe(stage);
      expect(await advance.execute({ progressId: progress.id, targetStage: stage })).toEqual(progress);
    }
    expect(progress.currentStage).toBe("RETEST");
    context.sqlite.close();
  });

  it("resumes the exact active progression without creating a row", async () => {
    const context = await setup();
    const progress = await new StartUnitProgress(context.repository, context.repository, context.ids, context.clock).execute(progressInput);
    const resumed = await new ResumeUnitProgress(context.repository).execute(progressInput);
    expect(resumed).toEqual(progress);
    expect(context.sqlite.prepare("SELECT COUNT(*) AS count FROM foundation_unit_progress").get()).toEqual({ count: 1 });
    await expect(new ResumeUnitProgress(context.repository).execute({ ...progressInput, learnerId: "d0000000-0000-4000-8000-000000000002" })).rejects.toMatchObject({ code: "FOUNDATION_PROGRESS_INVALID_TRANSITION" });
    context.sqlite.close();
  });

  it("persists an exit decision and forces RETEST_REQUIRED for unresolved critical evidence", async () => {
    const context = await setup();
    let progress = await new StartUnitProgress(context.repository, context.repository, context.ids, context.clock).execute(progressInput);
    const advance = new AdvanceUnit(context.repository, context.clock);
    for (const stage of FOUNDATION_UNIT_STAGES.slice(1, 6)) progress = await advance.execute({ progressId: progress.id, targetStage: stage });
    const { diagnostic } = await startDiagnosticWithObservation(context, true);
    const assessment = await new CompleteExitAssessment(context.repository, context.policy, context.ids, context.clock).execute({ progressId: progress.id, diagnosticId: diagnostic.id, result: { satisfactory: false } });
    expect(assessment).toMatchObject({ status: "COMPLETED", pedagogicalDecision: "RETEST_REQUIRED", ruleVersion: "synthetic-progress-v1" });
    expect((await context.repository.findExitAssessment(assessment.id))?.pedagogicalDecision).toBe("RETEST_REQUIRED");
    context.sqlite.close();
  });

  it("persists a positive exit decision when no critical evidence is unresolved", async () => {
    const context = await setup();
    let progress = await new StartUnitProgress(context.repository, context.repository, context.ids, context.clock).execute(progressInput);
    const advance = new AdvanceUnit(context.repository, context.clock);
    for (const stage of FOUNDATION_UNIT_STAGES.slice(1, 6)) progress = await advance.execute({ progressId: progress.id, targetStage: stage });
    const { diagnostic } = await startDiagnosticWithObservation(context);
    const assessment = await new CompleteExitAssessment(context.repository, context.policy, context.ids, context.clock).execute({ progressId: progress.id, diagnosticId: diagnostic.id, result: { satisfactory: true } });
    expect(assessment.pedagogicalDecision).toBe("READY_FOR_MCQ");
    context.sqlite.close();
  });

  it("records append-only re-tests and derives critical-error resolution from satisfactory later proof", async () => {
    const context = await setup();
    let progress = await new StartUnitProgress(context.repository, context.repository, context.ids, context.clock).execute(progressInput);
    const advance = new AdvanceUnit(context.repository, context.clock);
    for (const stage of FOUNDATION_UNIT_STAGES.slice(1)) progress = await advance.execute({ progressId: progress.id, targetStage: stage });
    const { diagnostic, observation: critical } = await startDiagnosticWithObservation(context, true);
    const resolver = new ResolveCriticalError(context.repository, context.policy);
    expect(await resolver.execute({ diagnosticId: diagnostic.id, criticalObservationId: critical.id })).toMatchObject({ resolved: false, resolvingObservationId: null });
    const retest = new RecordRetest(context.repository, context.ids, context.clock);
    const insufficient = await retest.execute({ progressId: progress.id, diagnosticId: diagnostic.id, criticalObservationId: critical.id, satisfactory: false, confidence: 0.6, durationMs: 900 });
    expect(insufficient.id).not.toBe(critical.id);
    expect((await resolver.execute({ diagnosticId: diagnostic.id, criticalObservationId: critical.id })).resolved).toBe(false);
    const satisfactory = await retest.execute({ progressId: progress.id, diagnosticId: diagnostic.id, criticalObservationId: critical.id, satisfactory: true, confidence: 0.9, durationMs: 800 });
    expect(await resolver.execute({ diagnosticId: diagnostic.id, criticalObservationId: critical.id })).toMatchObject({ resolved: true, resolvingObservationId: satisfactory.id, ruleVersion: "synthetic-progress-v1" });
    const persisted = await context.repository.findDiagnostic(diagnostic.id);
    expect(persisted?.observations.map(({ id }) => id)).toEqual([critical.id, insufficient.id, satisfactory.id]);
    expect(persisted?.observations[0]).toEqual(critical);
    context.sqlite.close();
  });
});
