import type { UseCase } from "@/application/contracts";
import {
  advanceFoundationUnitProgress,
  completeExitAssessment as finalizeExitAssessment,
  createExitAssessment,
  createFoundationUnitProgress,
  defineDiagnosticObservation,
  FoundationError,
  recordDiagnosticObservation,
  type CriticalErrorCategory,
  type DiagnosticObservation,
  type ExitAssessment,
  type FoundationUnitProgress,
  type FoundationUnitStage,
} from "@/domain/foundation";
import type {
  FoundationClock,
  FoundationCurriculumRepository,
  FoundationIdGenerator,
  FoundationLearningRepository,
  FoundationProgressPolicy,
} from "./foundation-ports";

const invalid = (message: string): never => {
  throw new FoundationError("FOUNDATION_PROGRESS_INVALID_TRANSITION", message);
};
const diagnosticInvalid = (message: string): never => {
  throw new FoundationError("FOUNDATION_DIAGNOSTIC_INVALID", message);
};

export type StartUnitProgressInput = Readonly<{ learnerId: string; curriculumVersionId: string; unitId: string }>;
export class StartUnitProgress implements UseCase<StartUnitProgressInput, FoundationUnitProgress> {
  constructor(
    private readonly curriculum: FoundationCurriculumRepository,
    private readonly learning: FoundationLearningRepository,
    private readonly ids: FoundationIdGenerator,
    private readonly clock: FoundationClock,
  ) {}
  async execute(input: StartUnitProgressInput): Promise<FoundationUnitProgress> {
    const curriculum = await this.curriculum.findVersion(input.curriculumVersionId);
    if (!curriculum || !curriculum.units.some(({ id }) => id === input.unitId)) invalid("Unit is unavailable in this curriculum.");
    const existing = await this.learning.findActiveUnitProgress(input.learnerId, input.curriculumVersionId, input.unitId);
    if (existing) return existing;
    const progress = createFoundationUnitProgress({ ...input, id: this.ids.next(), startedAt: this.clock.now() });
    await this.learning.saveUnitProgress(progress);
    return progress;
  }
}

export type AdvanceUnitInput = Readonly<{ progressId: string; targetStage: FoundationUnitStage }>;
export class AdvanceUnit implements UseCase<AdvanceUnitInput, FoundationUnitProgress> {
  constructor(private readonly learning: FoundationLearningRepository, private readonly clock: FoundationClock) {}
  async execute(input: AdvanceUnitInput): Promise<FoundationUnitProgress> {
    const progress = (await this.learning.findUnitProgress(input.progressId)) ?? invalid("Unit progress was not found.");
    const advanced = advanceFoundationUnitProgress(progress, input.targetStage, this.clock.now());
    if (advanced !== progress) await this.learning.saveUnitProgress(advanced);
    return advanced;
  }
}

export class ResumeUnitProgress implements UseCase<StartUnitProgressInput, FoundationUnitProgress> {
  constructor(private readonly learning: FoundationLearningRepository) {}
  async execute(input: StartUnitProgressInput): Promise<FoundationUnitProgress> {
    return (await this.learning.findActiveUnitProgress(input.learnerId, input.curriculumVersionId, input.unitId)) ??
      invalid("No active unit progress exists.");
  }
}

export type CriticalErrorResolution = Readonly<{
  criticalObservationId: string;
  resolved: boolean;
  resolvingObservationId: string | null;
  ruleVersion: string;
}>;

export class ResolveCriticalError implements UseCase<Readonly<{ diagnosticId: string; criticalObservationId: string }>, CriticalErrorResolution> {
  constructor(private readonly learning: FoundationLearningRepository, private readonly policy: FoundationProgressPolicy) {}
  async execute(input: Readonly<{ diagnosticId: string; criticalObservationId: string }>): Promise<CriticalErrorResolution> {
    const diagnostic = (await this.learning.findDiagnostic(input.diagnosticId)) ?? diagnosticInvalid("Diagnostic was not found.");
    const critical = diagnostic.observations.find(({ id }) => id === input.criticalObservationId);
    if (!critical || !critical.criticalErrorCategory) {
      throw new FoundationError("FOUNDATION_DIAGNOSTIC_INVALID", "Critical observation was not found.");
    }
    const resolving = diagnostic.observations.find((candidate) =>
      candidate.id !== critical.id &&
      candidate.activityType === "RETEST" &&
      candidate.outcome.retestOfObservationId === critical.id &&
      Date.parse(candidate.observedAt) >= Date.parse(critical.observedAt) &&
      this.policy.isRetestSatisfactory(candidate));
    return Object.freeze({ criticalObservationId: critical.id, resolved: Boolean(resolving), resolvingObservationId: resolving?.id ?? null, ruleVersion: this.policy.ruleVersion });
  }
}

export type RecordRetestInput = Readonly<{
  progressId: string;
  diagnosticId: string;
  criticalObservationId: string;
  satisfactory: boolean;
  confidence: number | null;
  durationMs: number | null;
}>;
export class RecordRetest implements UseCase<RecordRetestInput, DiagnosticObservation> {
  constructor(
    private readonly learning: FoundationLearningRepository,
    private readonly ids: FoundationIdGenerator,
    private readonly clock: FoundationClock,
  ) {}
  async execute(input: RecordRetestInput): Promise<DiagnosticObservation> {
    const progress = (await this.learning.findUnitProgress(input.progressId)) ?? invalid("Unit progress was not found.");
    if (progress.currentStage !== "RETEST" || progress.status !== "IN_PROGRESS") invalid("A re-test requires active RETEST progress.");
    const diagnostic = (await this.learning.findDiagnostic(input.diagnosticId)) ?? diagnosticInvalid("Diagnostic was not found.");
    if (diagnostic.learnerId !== progress.learnerId || diagnostic.curriculumVersionId !== progress.curriculumVersionId) {
      diagnosticInvalid("Diagnostic is outside the active unit progress.");
    }
    const critical = diagnostic.observations.find(({ id }) => id === input.criticalObservationId);
    if (!critical || !critical.criticalErrorCategory || critical.unitId !== progress.unitId || critical.learnerId !== progress.learnerId) {
      throw new FoundationError("FOUNDATION_DIAGNOSTIC_INVALID", "Critical observation is outside the active unit progress.");
    }
    const observation = defineDiagnosticObservation({
      id: this.ids.next(),
      diagnosticId: diagnostic.id,
      learnerId: diagnostic.learnerId,
      curriculumVersionId: diagnostic.curriculumVersionId,
      blockId: critical.blockId,
      unitId: critical.unitId,
      objectiveId: critical.objectiveId,
      activityType: "RETEST",
      outcome: { retestOfObservationId: critical.id, satisfactory: input.satisfactory },
      confidence: input.confidence,
      durationMs: input.durationMs,
      criticalErrorCategory: input.satisfactory ? null : critical.criticalErrorCategory,
      evidenceType: "FOUNDATION",
      evidenceRefId: null,
      evidenceRefVersion: null,
      observedAt: this.clock.now(),
    });
    const updated = recordDiagnosticObservation(diagnostic, observation);
    await this.learning.saveDiagnostic(updated);
    return observation;
  }
}

export type CompleteExitAssessmentInput = Readonly<{
  progressId: string;
  diagnosticId: string;
  result: Readonly<Record<string, unknown>>;
}>;
export class CompleteExitAssessment implements UseCase<CompleteExitAssessmentInput, ExitAssessment> {
  constructor(
    private readonly learning: FoundationLearningRepository,
    private readonly policy: FoundationProgressPolicy,
    private readonly ids: FoundationIdGenerator,
    private readonly clock: FoundationClock,
  ) {}
  async execute(input: CompleteExitAssessmentInput): Promise<ExitAssessment> {
    const progress = (await this.learning.findUnitProgress(input.progressId)) ?? invalid("Unit progress was not found.");
    if (progress.currentStage !== "EXIT_ASSESSMENT" || progress.status !== "IN_PROGRESS") invalid("Exit assessment requires the EXIT_ASSESSMENT stage.");
    const diagnostic = (await this.learning.findDiagnostic(input.diagnosticId)) ?? diagnosticInvalid("Diagnostic was not found.");
    if (diagnostic.learnerId !== progress.learnerId || diagnostic.curriculumVersionId !== progress.curriculumVersionId) {
      diagnosticInvalid("Diagnostic is outside the active unit progress.");
    }
    const observations = diagnostic.observations.filter(({ unitId }) => unitId === progress.unitId);
    if (observations.length === 0) diagnosticInvalid("Exit assessment requires unit observation evidence.");
    const resolver = new ResolveCriticalError(this.learning, this.policy);
    const unresolved: CriticalErrorCategory[] = [];
    for (const critical of observations.filter(({ criticalErrorCategory }) => criticalErrorCategory !== null)) {
      const resolution = await resolver.execute({ diagnosticId: diagnostic.id, criticalObservationId: critical.id });
      if (!resolution.resolved) unresolved.push(critical.criticalErrorCategory!);
    }
    const startedAt = this.clock.now();
    const assessment = createExitAssessment({ id: this.ids.next(), learnerId: progress.learnerId, curriculumVersionId: progress.curriculumVersionId, unitId: progress.unitId, startedAt, ruleVersion: this.policy.ruleVersion });
    const completed = finalizeExitAssessment(assessment, { completedAt: this.clock.now(), observationIds: observations.map(({ id }) => id), result: input.result, unresolvedCriticalErrors: unresolved, decision: this.policy.decideExit(observations) });
    await this.learning.saveExitAssessment(completed);
    return completed;
  }
}
