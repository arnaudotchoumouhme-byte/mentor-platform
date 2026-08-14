import "server-only";
import { randomUUID } from "node:crypto";
import type { DiagnosticObservation } from "@/domain/foundation";
import { INITIAL_FOUNDATION_CURRICULUM_ID } from "@/application/foundation/foundation-curriculum-seed";
import { CompleteDiagnostic, EstimateMastery, RecommendFoundationPath, RecordObservation, StartDiagnostic } from "@/application/foundation/foundation-diagnostic-use-cases";
import type { FoundationDiagnosticPolicy, FoundationProgressPolicy } from "@/application/foundation/foundation-ports";
import { AdvanceUnit, CompleteExitAssessment, RecordRetest, ResolveCriticalError, ResumeUnitProgress, StartUnitProgress } from "@/application/foundation/foundation-unit-progression-use-cases";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";
import { AppError } from "@/shared/errors/app-error";
import { SqliteFoundationRepository } from "./sqlite-foundation-repository";

const repository = new SqliteFoundationRepository(sqliteExecutor);
const ids = { next: () => randomUUID() };
const clock = { now: () => new Date().toISOString() };

const diagnosticPolicy: FoundationDiagnosticPolicy = {
  ruleVersion: "foundation-internal-provisional-v1",
  estimate: ({ observations }) => ({ level: observations.length === 0 ? "N0" : "N1", confidence: observations.length === 0 ? 0 : 0.5 }),
  recommend: () => ({ decision: "REQUIRED", justification: "Recommandation pédagogique interne provisoire; aucune décision officielle PEBC." }),
};
const progressPolicy: FoundationProgressPolicy = {
  ruleVersion: "foundation-internal-provisional-v1",
  decideExit: () => "CONTINUE_FOUNDATION",
  isRetestSatisfactory: (observation: DiagnosticObservation) => observation.outcome.satisfactory === true,
};
const notFound = (resource: string): never => {
  throw new AppError({ code: "NOT_FOUND", userMessage: "Ressource Foundation introuvable.", internalMessage: `${resource} was not found.` });
};

export const foundationApi = Object.freeze({
  curriculum: { execute: async (id = INITIAL_FOUNDATION_CURRICULUM_ID) => (await repository.findVersion(id)) ?? notFound("Curriculum") },
  diagnostic: { execute: async (id: string) => (await repository.findDiagnostic(id)) ?? notFound("Diagnostic") },
  mastery: { execute: (learnerId: string) => repository.listMasteryEstimates(learnerId) },
  recommendations: { execute: (learnerId: string) => repository.listRecommendations(learnerId) },
  progress: { execute: async (id: string) => (await repository.findUnitProgress(id)) ?? notFound("Unit progress") },
  exitAssessment: { execute: async (id: string) => (await repository.findExitAssessment(id)) ?? notFound("Exit assessment") },
  startDiagnostic: new StartDiagnostic(repository, repository, ids, clock),
  recordObservation: new RecordObservation(repository, repository, ids, clock),
  completeDiagnostic: new CompleteDiagnostic(repository, clock),
  estimateMastery: new EstimateMastery(repository, repository, diagnosticPolicy, ids, clock),
  recommend: new RecommendFoundationPath(repository, diagnosticPolicy, ids, clock),
  startProgress: new StartUnitProgress(repository, repository, ids, clock),
  resumeProgress: new ResumeUnitProgress(repository),
  advanceProgress: new AdvanceUnit(repository, clock),
  completeExitAssessment: new CompleteExitAssessment(repository, progressPolicy, ids, clock),
  recordRetest: new RecordRetest(repository, ids, clock),
  resolveCriticalError: new ResolveCriticalError(repository, progressPolicy),
});

export type FoundationApi = typeof foundationApi;
