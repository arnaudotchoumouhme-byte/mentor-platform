import { performance } from "node:perf_hooks";
import { CalculationError, evaluateCalculation, type CalculationAttempt, type CalculationSubmission, type CalculationRetest } from "@/domain/calculations";
import type { CalculationsClock, CalculationsIds, CalculationsLogger, CalculationsRepository } from "./calculations-ports";

export class GetCalculationExercise {
  constructor(private readonly repository: CalculationsRepository, private readonly logger: CalculationsLogger) {}
  async execute(id: string, traceId: string) { const value = await this.repository.findExerciseVersion(id); if (!value) throw new CalculationError("CALCULATION_VERSION_NOT_FOUND", "Exercise version was not found."); this.logger.event({ name: "calculations.exercise_loaded", traceId, status: "success", context: { exerciseId: value.exerciseId, exerciseVersion: value.version } }); return value; }
}
export class SubmitCalculationAttempt {
  constructor(private readonly repository: CalculationsRepository, private readonly ids: CalculationsIds, private readonly clock: CalculationsClock, private readonly logger: CalculationsLogger) {}
  async execute(input: Readonly<{ learnerId: string; exerciseVersionId: string; submission: CalculationSubmission; traceId: string }>): Promise<CalculationAttempt> {
    const started = performance.now(); const exercise = await this.repository.findExerciseVersion(input.exerciseVersionId); if (!exercise) throw new CalculationError("CALCULATION_VERSION_NOT_FOUND", "Exercise version was not found.");
    const evaluation = evaluateCalculation(exercise, input.submission); const attempt = Object.freeze({ id: this.ids.next(), learnerId: input.learnerId, exerciseVersionId: exercise.id, submittedAt: this.clock.now(), submission: input.submission, evaluation }); await this.repository.saveAttempt(attempt);
    this.logger.event({ name: "calculations.attempt_evaluated", traceId: input.traceId, status: "success", context: { exerciseId: exercise.exerciseId, exerciseVersion: exercise.version, outcome: evaluation.correct ? "CORRECT" : "INCORRECT", errorCategory: evaluation.observations[0]?.category ?? null, critical: evaluation.observations.some(({ critical }) => critical), duration_ms: Math.round(performance.now() - started) } }); return attempt;
  }
}
export class PrepareCalculationRetest {
  constructor(private readonly repository: CalculationsRepository, private readonly ids: CalculationsIds, private readonly clock: CalculationsClock, private readonly logger: CalculationsLogger) {}
  async execute(input: Readonly<{ sourceAttemptId: string; exerciseVersionId: string; traceId: string }>): Promise<CalculationRetest> { const source = await this.repository.findAttempt(input.sourceAttemptId); const exercise = await this.repository.findExerciseVersion(input.exerciseVersionId); if (!source || source.evaluation.correct || !exercise) throw new CalculationError("CALCULATION_RETEST_INVALID", "Retest requires an unsuccessful source attempt and a valid exercise version."); const retest = Object.freeze({ id: this.ids.next(), sourceAttemptId: source.id, exerciseVersionId: exercise.id, createdAt: this.clock.now(), resultAttemptId: null, resolved: false }); await this.repository.saveRetest(retest); this.logger.event({ name: "calculations.retest_recorded", traceId: input.traceId, status: "success", context: { exerciseId: exercise.exerciseId, exerciseVersion: exercise.version, outcome: "PENDING", errorCategory: source.evaluation.observations[0]?.category ?? null, critical: source.evaluation.observations.some(({ critical }) => critical), duration_ms: 0 } }); return retest; }
}
