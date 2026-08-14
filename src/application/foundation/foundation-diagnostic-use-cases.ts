import type { UseCase } from "@/application/contracts";
import {
  completeFoundationDiagnostic,
  createFoundationDiagnostic,
  defineDiagnosticObservation,
  defineFoundationRecommendation,
  defineMasteryEstimate,
  FoundationError,
  recordDiagnosticObservation,
  type CriticalErrorCategory,
  type DiagnosticObservation,
  type FoundationDiagnostic,
  type FoundationRecommendation,
  type MasteryEstimate,
  type ObservationEvidenceType,
} from "@/domain/foundation";
import type {
  FoundationClock,
  FoundationCurriculumRepository,
  FoundationCurriculumSnapshot,
  FoundationDiagnosticPolicy,
  FoundationIdGenerator,
  FoundationLearningRepository,
  FoundationPolicyScope,
} from "./foundation-ports";

const missing = (entity: string): never => {
  throw new FoundationError("FOUNDATION_DIAGNOSTIC_INVALID", `${entity} was not found.`);
};

const curriculumFor = async (
  repository: FoundationCurriculumRepository,
  curriculumVersionId: string,
): Promise<FoundationCurriculumSnapshot> =>
  (await repository.findVersion(curriculumVersionId)) ?? missing("Curriculum version");

const assertScope = (
  curriculum: FoundationCurriculumSnapshot,
  blockId: string,
  unitId: string | null,
  objectiveId: string | null,
): void => {
  const block = curriculum.blocks.find(({ id }) => id === blockId);
  const unit = unitId ? curriculum.units.find(({ id, blockId: ownerBlockId }) => id === unitId && ownerBlockId === block?.id) : null;
  const objective = objectiveId
    ? curriculum.objectives.find(({ id, unitId: ownerUnitId }) => id === objectiveId && ownerUnitId === unit?.id)
    : null;
  if (!block || (unitId && !unit) || (objectiveId && !objective)) {
    throw new FoundationError("FOUNDATION_OBSERVATION_INVALID", "Foundation scope is outside the curriculum hierarchy.");
  }
};

const scopedObservations = (
  diagnostic: FoundationDiagnostic,
  blockId: string,
  unitId: string | null,
  objectiveId: string | null,
): readonly DiagnosticObservation[] => diagnostic.observations.filter((observation) =>
  observation.blockId === blockId &&
  (unitId === null || observation.unitId === unitId) &&
  (objectiveId === null || observation.objectiveId === objectiveId));

export type StartDiagnosticInput = Readonly<{
  learnerId: string;
  curriculumVersionId: string;
  targetBlockIds: readonly string[];
  expectedCount: number | null;
}>;

export class StartDiagnostic implements UseCase<StartDiagnosticInput, FoundationDiagnostic> {
  constructor(
    private readonly curriculum: FoundationCurriculumRepository,
    private readonly learning: FoundationLearningRepository,
    private readonly ids: FoundationIdGenerator,
    private readonly clock: FoundationClock,
  ) {}

  async execute(input: StartDiagnosticInput): Promise<FoundationDiagnostic> {
    const curriculum = await curriculumFor(this.curriculum, input.curriculumVersionId);
    if (curriculum.version.status === "RETIRED" ||
        input.targetBlockIds.some((id) => !curriculum.blocks.some((block) => block.id === id))) {
      throw new FoundationError("FOUNDATION_DIAGNOSTIC_INVALID", "Diagnostic scope is unavailable in this curriculum.");
    }
    const diagnostic = createFoundationDiagnostic({
      id: this.ids.next(),
      learnerId: input.learnerId,
      curriculumVersionId: input.curriculumVersionId,
      targetBlockIds: input.targetBlockIds,
      startedAt: this.clock.now(),
      expectedCount: input.expectedCount,
    });
    await this.learning.saveDiagnostic(diagnostic);
    return diagnostic;
  }
}

export type RecordObservationInput = Readonly<{
  diagnosticId: string;
  blockId: string;
  unitId: string | null;
  objectiveId: string | null;
  activityType: string;
  outcome: Readonly<Record<string, unknown>>;
  confidence: number | null;
  durationMs: number | null;
  criticalErrorCategory: CriticalErrorCategory | null;
  evidenceType: ObservationEvidenceType;
  evidenceRefId: string | null;
  evidenceRefVersion: string | null;
}>;

export class RecordObservation implements UseCase<RecordObservationInput, FoundationDiagnostic> {
  constructor(
    private readonly curriculum: FoundationCurriculumRepository,
    private readonly learning: FoundationLearningRepository,
    private readonly ids: FoundationIdGenerator,
    private readonly clock: FoundationClock,
  ) {}

  async execute(input: RecordObservationInput): Promise<FoundationDiagnostic> {
    const diagnostic = (await this.learning.findDiagnostic(input.diagnosticId)) ?? missing("Diagnostic");
    const curriculum = await curriculumFor(this.curriculum, diagnostic.curriculumVersionId);
    assertScope(curriculum, input.blockId, input.unitId, input.objectiveId);
    const observation = defineDiagnosticObservation({
      ...input,
      id: this.ids.next(),
      learnerId: diagnostic.learnerId,
      curriculumVersionId: diagnostic.curriculumVersionId,
      observedAt: this.clock.now(),
    });
    const updated = recordDiagnosticObservation(diagnostic, observation);
    await this.learning.saveDiagnostic(updated);
    return updated;
  }
}

export class CompleteDiagnostic implements UseCase<string, FoundationDiagnostic> {
  constructor(private readonly learning: FoundationLearningRepository, private readonly clock: FoundationClock) {}
  async execute(diagnosticId: string): Promise<FoundationDiagnostic> {
    const diagnostic = (await this.learning.findDiagnostic(diagnosticId)) ?? missing("Diagnostic");
    if (diagnostic.status === "COMPLETED") return diagnostic;
    const completed = completeFoundationDiagnostic(diagnostic, this.clock.now());
    await this.learning.saveDiagnostic(completed);
    return completed;
  }
}

export type FoundationEstimateInput = Readonly<{
  diagnosticId: string;
  blockId: string;
  unitId: string | null;
  objectiveId: string | null;
}>;

export class EstimateMastery implements UseCase<FoundationEstimateInput, MasteryEstimate> {
  constructor(
    private readonly curriculum: FoundationCurriculumRepository,
    private readonly learning: FoundationLearningRepository,
    private readonly policy: FoundationDiagnosticPolicy,
    private readonly ids: FoundationIdGenerator,
    private readonly clock: FoundationClock,
  ) {}

  async execute(input: FoundationEstimateInput): Promise<MasteryEstimate> {
    const diagnostic = (await this.learning.findDiagnostic(input.diagnosticId)) ?? missing("Diagnostic");
    const curriculum = await curriculumFor(this.curriculum, diagnostic.curriculumVersionId);
    assertScope(curriculum, input.blockId, input.unitId, input.objectiveId);
    const observations = scopedObservations(diagnostic, input.blockId, input.unitId, input.objectiveId);
    const scope: FoundationPolicyScope = { learnerId: diagnostic.learnerId, curriculumVersionId: diagnostic.curriculumVersionId, blockId: input.blockId, unitId: input.unitId, objectiveId: input.objectiveId, observations };
    const result = this.policy.estimate(scope);
    const estimate = defineMasteryEstimate({
      id: this.ids.next(),
      learnerId: scope.learnerId,
      curriculumVersionId: scope.curriculumVersionId,
      blockId: scope.blockId,
      unitId: scope.unitId,
      objectiveId: scope.objectiveId,
      level: result.level,
      confidence: result.confidence,
      calculatedAt: this.clock.now(),
      evidenceObservationIds: observations.map(({ id }) => id),
      ruleVersion: this.policy.ruleVersion,
    });
    await this.learning.appendMasteryEstimate(estimate);
    return estimate;
  }
}

export type FoundationRecommendationInput = Readonly<{
  diagnosticId: string;
  mastery: MasteryEstimate;
  supersedesId: string | null;
}>;

export class RecommendFoundationPath implements UseCase<FoundationRecommendationInput, FoundationRecommendation> {
  constructor(
    private readonly learning: FoundationLearningRepository,
    private readonly policy: FoundationDiagnosticPolicy,
    private readonly ids: FoundationIdGenerator,
    private readonly clock: FoundationClock,
  ) {}

  async execute(input: FoundationRecommendationInput): Promise<FoundationRecommendation> {
    const diagnostic = (await this.learning.findDiagnostic(input.diagnosticId)) ?? missing("Diagnostic");
    if (input.mastery.learnerId !== diagnostic.learnerId ||
        input.mastery.curriculumVersionId !== diagnostic.curriculumVersionId) {
      throw new FoundationError("FOUNDATION_RECOMMENDATION_INVALID", "Mastery and diagnostic scopes are inconsistent.");
    }
    const observations = scopedObservations(diagnostic, input.mastery.blockId, input.mastery.unitId, input.mastery.objectiveId);
    if (observations.length === 0) {
      throw new FoundationError("FOUNDATION_RECOMMENDATION_INVALID", "A Foundation recommendation requires observation evidence.");
    }
    const scope: FoundationPolicyScope = { learnerId: diagnostic.learnerId, curriculumVersionId: diagnostic.curriculumVersionId, blockId: input.mastery.blockId, unitId: input.mastery.unitId, objectiveId: input.mastery.objectiveId, observations };
    const proposed = this.policy.recommend({ ...scope, mastery: input.mastery });
    const hasCriticalError = observations.some(({ criticalErrorCategory }) => criticalErrorCategory !== null);
    const decision = hasCriticalError && proposed.decision !== "REQUIRED" ? "REQUIRED" : proposed.decision;
    const justification = hasCriticalError && proposed.decision !== "REQUIRED"
      ? "Foundation review required because unresolved critical evidence is present."
      : proposed.justification;
    const recommendation = defineFoundationRecommendation({
      id: this.ids.next(),
      learnerId: diagnostic.learnerId,
      curriculumVersionId: diagnostic.curriculumVersionId,
      blockId: input.mastery.blockId,
      unitId: input.mastery.unitId,
      decision,
      justification,
      evidenceObservationIds: observations.map(({ id }) => id),
      ruleVersion: this.policy.ruleVersion,
      decidedAt: this.clock.now(),
      supersedesId: input.supersedesId,
    });
    await this.learning.appendRecommendation(recommendation);
    return recommendation;
  }
}
