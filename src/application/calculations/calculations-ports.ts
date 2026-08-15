import type { CalculationAttempt, CalculationExerciseVersion, CalculationRetest } from "@/domain/calculations";
export interface CalculationsRepository {
  findExerciseVersion(id: string): Promise<CalculationExerciseVersion | null>;
  saveExerciseVersion(value: CalculationExerciseVersion): Promise<void>;
  saveAttempt(value: CalculationAttempt): Promise<void>;
  findAttempt(id: string): Promise<CalculationAttempt | null>;
  listAttempts(exerciseVersionId: string, learnerId: string): Promise<readonly CalculationAttempt[]>;
  saveRetest(value: CalculationRetest): Promise<void>;
  findRetest(id: string): Promise<CalculationRetest | null>;
}
export interface CalculationsIds { next(): string }
export interface CalculationsClock { now(): string }
export interface CalculationsLogger { event(value: Readonly<{ name: "calculations.exercise_loaded" | "calculations.attempt_evaluated" | "calculations.retest_recorded"; traceId: string; status: "success" | "failure"; context: Readonly<Record<string, unknown>> }>): void }
