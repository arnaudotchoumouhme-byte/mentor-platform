import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { FoundationCurriculumSnapshot } from "@/application/foundation/foundation-ports";
import {
  advanceFoundationUnitProgress,
  completeExitAssessment,
  completeFoundationDiagnostic,
  createExitAssessment,
  createFoundationDiagnostic,
  createFoundationUnitProgress,
  defineCurriculumBlock,
  defineCurriculumUnit,
  defineCurriculumVersion,
  defineDiagnosticObservation,
  defineFoundationRecommendation,
  defineLearningObjective,
  defineMasteryEstimate,
  definePrerequisiteRule,
  recordDiagnosticObservation,
} from "@/domain/foundation";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { FreshDatabaseBootstrap } from "@/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import { SqliteFoundationRepository } from "./sqlite-foundation-repository";

const id = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const ids = { curriculum: id("1"), program: id("2"), block: id("3"), unit: id("4"), otherUnit: id("5"), objective: id("6"), prerequisite: id("7"), learner: id("8"), diagnostic: id("9"), observation: id("a"), mastery: id("b"), recommendation: id("c"), exit: id("d"), progress: id("e") };
const executor = (sqlite: DatabaseSync): SqliteExecutor => ({ all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) });
const setup = () => { const sqlite = new DatabaseSync(":memory:"); sqlite.exec("PRAGMA foreign_keys=ON"); const database = executor(sqlite); new FreshDatabaseBootstrap(database).run(); return { sqlite, repository: new SqliteFoundationRepository(database) }; };

const snapshot = (): FoundationCurriculumSnapshot => {
  const version = defineCurriculumVersion({ id: ids.curriculum, programId: ids.program, version: 1, status: "DRAFT", effectiveFrom: "2027-01-01T00:00:00.000Z", effectiveTo: null, createdAt: "2026-08-13T00:00:00.000Z", publishedAt: null });
  const block = defineCurriculumBlock({ id: ids.block, curriculumVersionId: ids.curriculum, code: "BIO", title: "Biomedical", position: 0, isRequired: true });
  const unit = defineCurriculumUnit({ id: ids.unit, blockId: ids.block, code: "U1", title: "Unit 1", description: "Description", estimatedDurationMinutes: 30, position: 0, status: "ACTIVE" });
  const otherUnit = defineCurriculumUnit({ id: ids.otherUnit, blockId: ids.block, code: "U2", title: "Unit 2", description: "Description", estimatedDurationMinutes: 30, position: 1, status: "ACTIVE" });
  const objective = defineLearningObjective({ id: ids.objective, unitId: ids.unit, code: "O1", statement: "Explain a concept", objectiveType: "KNOWLEDGE", position: 0 });
  const prerequisite = definePrerequisiteRule({ id: ids.prerequisite, unitId: ids.otherUnit, requiredUnitId: ids.unit, requiredObjectiveId: null, minimumMasteryLevel: "N2", createdAt: "2026-08-13T00:00:00.000Z" });
  return Object.freeze({ version, blocks: [block], units: [unit, otherUnit], objectives: [objective], prerequisites: [prerequisite] });
};

const observedDiagnostic = () => {
  const diagnostic = createFoundationDiagnostic({ id: ids.diagnostic, learnerId: ids.learner, curriculumVersionId: ids.curriculum, targetBlockIds: [ids.block], startedAt: "2026-08-13T00:00:00.000Z", expectedCount: 1 });
  const observation = defineDiagnosticObservation({ id: ids.observation, diagnosticId: ids.diagnostic, learnerId: ids.learner, curriculumVersionId: ids.curriculum, blockId: ids.block, unitId: ids.unit, objectiveId: ids.objective, activityType: "PRE_TEST", outcome: { correct: true }, confidence: 0.8, durationMs: 1000, criticalErrorCategory: null, evidenceType: "FOUNDATION", evidenceRefId: null, evidenceRefVersion: null, observedAt: "2026-08-13T00:01:00.000Z" });
  return completeFoundationDiagnostic(recordDiagnosticObservation(diagnostic, observation), "2026-08-13T00:02:00.000Z");
};

describe("SqliteFoundationRepository", () => {
  it("saves and reads the curriculum hierarchy in one transaction", async () => {
    const { sqlite, repository } = setup();
    const curriculum = snapshot();
    await repository.save(curriculum);
    expect(await repository.findVersion(ids.curriculum)).toEqual(curriculum);
    const invalid = { ...snapshot(), version: { ...snapshot().version, id: id("f") }, blocks: [{ ...snapshot().blocks[0]!, curriculumVersionId: id("f") }, { ...snapshot().blocks[0]!, id: id("0"), curriculumVersionId: id("f") }] };
    await expect(repository.save(invalid)).rejects.toMatchObject({ code: "FOUNDATION_PERSISTENCE_ERROR" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM curriculum_versions WHERE curriculum_version_id=?").get(id("f"))).toEqual({ count: 0 });
    sqlite.close();
  });

  it("persists diagnostic observations atomically and append-only", async () => {
    const { sqlite, repository } = setup();
    await repository.save(snapshot());
    const diagnostic = observedDiagnostic();
    await repository.saveDiagnostic(diagnostic);
    expect(await repository.findDiagnostic(ids.diagnostic)).toEqual(diagnostic);
    await repository.saveDiagnostic(diagnostic);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM diagnostic_observations").get()).toEqual({ count: 1 });
    sqlite.close();
  });

  it("appends estimates and recommendations and persists exit/progress transitions", async () => {
    const { sqlite, repository } = setup();
    await repository.save(snapshot());
    await repository.saveDiagnostic(observedDiagnostic());
    const estimate = defineMasteryEstimate({ id: ids.mastery, learnerId: ids.learner, curriculumVersionId: ids.curriculum, blockId: ids.block, unitId: ids.unit, objectiveId: ids.objective, level: "N2", confidence: 0.8, calculatedAt: "2026-08-13T00:03:00.000Z", evidenceObservationIds: [ids.observation], ruleVersion: "rules-v1" });
    const recommendation = defineFoundationRecommendation({ id: ids.recommendation, learnerId: ids.learner, curriculumVersionId: ids.curriculum, blockId: ids.block, unitId: ids.unit, decision: "RECOMMENDED", justification: "Continue practice", evidenceObservationIds: [ids.observation], ruleVersion: "rules-v1", decidedAt: "2026-08-13T00:04:00.000Z", supersedesId: null });
    await repository.appendMasteryEstimate(estimate); await repository.appendRecommendation(recommendation);
    expect(await repository.listMasteryEstimates(ids.learner)).toEqual([estimate]);
    expect(await repository.listRecommendations(ids.learner)).toEqual([recommendation]);
    await expect(repository.appendMasteryEstimate(estimate)).rejects.toMatchObject({ code: "FOUNDATION_PERSISTENCE_ERROR" });

    const exit = createExitAssessment({ id: ids.exit, learnerId: ids.learner, curriculumVersionId: ids.curriculum, unitId: ids.unit, startedAt: "2026-08-13T00:05:00.000Z", ruleVersion: "rules-v1" });
    await repository.saveExitAssessment(exit);
    const completedExit = completeExitAssessment(exit, { completedAt: "2026-08-13T00:06:00.000Z", observationIds: [ids.observation], result: { passed: true }, unresolvedCriticalErrors: [], decision: "READY_FOR_MCQ" });
    await repository.saveExitAssessment(completedExit);
    expect(await repository.findExitAssessment(ids.exit)).toEqual(completedExit);

    const progress = createFoundationUnitProgress({ id: ids.progress, learnerId: ids.learner, curriculumVersionId: ids.curriculum, unitId: ids.unit, startedAt: "2026-08-13T00:00:00.000Z" });
    await repository.saveUnitProgress(progress);
    const advanced = advanceFoundationUnitProgress(progress, "MICRO_LESSON", "2026-08-13T00:07:00.000Z");
    await repository.saveUnitProgress(advanced);
    expect(await repository.findUnitProgress(ids.progress)).toEqual(advanced);
    sqlite.close();
  });
});
