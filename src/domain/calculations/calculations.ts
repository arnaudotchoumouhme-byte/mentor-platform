import { AppError } from "@/shared/errors/app-error";

export type CalculationDimension = "MASS" | "VOLUME";
export type CalculationUnit = "mg" | "g" | "mL" | "L";
export type CalculationDifficulty = "FOUNDATIONAL" | "INTERMEDIATE" | "ADVANCED";
export type CalculationErrorCategory = "FORMULA" | "DATA" | "CONVERSION" | "UNIT" | "DIMENSION" | "ARITHMETIC" | "ROUNDING" | "PLAUSIBILITY";
export type Quantity = Readonly<{ value: number; unit: CalculationUnit }>;
export type CalculationStep = Readonly<{ position: number; label: string; expected: Quantity }>;
export type CalculationExerciseVersion = Readonly<{
  id: string; exerciseId: string; version: number; learningObjectiveId: string;
  difficulty: CalculationDifficulty; inputs: readonly Quantity[]; steps: readonly CalculationStep[];
  expectedResult: Quantity; dimension: CalculationDimension; tolerance: number;
  plausibility: Readonly<{ min: number; max: number }>; status: "DRAFT" | "ACTIVE" | "RETIRED"; createdAt: string;
}>;
export type CalculationSubmission = Readonly<{ steps: readonly Quantity[]; result: Quantity }>;
export type CalculationObservation = Readonly<{ step: number | null; parentCategory: "ERR-CALC"; category: CalculationErrorCategory; critical: boolean; message: string }>;
export type CalculationEvaluation = Readonly<{ correct: boolean; dimensionValid: boolean; plausible: boolean; mastered: boolean; observations: readonly CalculationObservation[]; remediation: Readonly<{ required: boolean; priority: "NORMAL" | "CRITICAL"; destination: "CALCULATIONS_LAB"; focus: readonly string[] }> }>;
export type PersistedCalculationObservation = Readonly<CalculationObservation & { id: string; attemptId: string }>;
export type CalculationAttempt = Readonly<{ id: string; learnerId: string; exerciseVersionId: string; submittedAt: string; submission: CalculationSubmission; evaluation: CalculationEvaluation; observations: readonly PersistedCalculationObservation[] }>;
export type CalculationRetest = Readonly<{ id: string; sourceAttemptId: string; sourceExerciseVersionId: string; retestExerciseVersionId: string; reason: CalculationErrorCategory; createdAt: string; completedAt: string | null; resultAttemptId: string | null; resolved: boolean }>;

export class CalculationError extends AppError {
  constructor(code: "CALCULATION_INVALID" | "CALCULATION_UNIT_UNSUPPORTED" | "CALCULATION_VERSION_NOT_FOUND" | "CALCULATION_RETEST_INVALID", message: string, context: Readonly<Record<string, unknown>> = {}) {
    super({ code, userMessage: "Les données du calcul sont invalides.", internalMessage: message, category: "validation", context });
    this.name = "CalculationError";
  }
}

const units: Readonly<Record<CalculationUnit, Readonly<{ dimension: CalculationDimension; factor: number }>>> = {
  mg: { dimension: "MASS", factor: 0.001 }, g: { dimension: "MASS", factor: 1 },
  mL: { dimension: "VOLUME", factor: 0.001 }, L: { dimension: "VOLUME", factor: 1 },
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const finite = (value: number, field: string) => { if (!Number.isFinite(value)) throw new CalculationError("CALCULATION_INVALID", `${field} must be finite.`); return value; };
const id = (value: string, field: string) => { if (!uuid.test(value)) throw new CalculationError("CALCULATION_INVALID", `${field} must be a UUID.`); return value; };
export const dimensionOf = (unit: CalculationUnit): CalculationDimension => units[unit]?.dimension ?? (() => { throw new CalculationError("CALCULATION_UNIT_UNSUPPORTED", "Unit is unsupported.", { unit }); })();
export function convert(quantity: Quantity, target: CalculationUnit): Quantity {
  finite(quantity.value, "quantity.value"); const source = units[quantity.unit]; const destination = units[target];
  if (!source || !destination) throw new CalculationError("CALCULATION_UNIT_UNSUPPORTED", "Unit is unsupported.");
  if (source.dimension !== destination.dimension) throw new CalculationError("CALCULATION_INVALID", "Dimensions are incompatible.");
  return Object.freeze({ value: quantity.value * source.factor / destination.factor, unit: target });
}

export function defineCalculationExerciseVersion(input: CalculationExerciseVersion): CalculationExerciseVersion {
  id(input.id, "id"); id(input.exerciseId, "exerciseId"); id(input.learningObjectiveId, "learningObjectiveId");
  if (!Number.isInteger(input.version) || input.version < 1 || input.steps.length === 0 || input.tolerance < 0) throw new CalculationError("CALCULATION_INVALID", "Version, steps or tolerance are invalid.");
  input.inputs.forEach((q) => { finite(q.value, "input"); dimensionOf(q.unit); });
  input.steps.forEach((step, index) => { if (step.position !== index + 1 || !step.label.trim()) throw new CalculationError("CALCULATION_INVALID", "Steps must be ordered and labelled."); finite(step.expected.value, "step"); dimensionOf(step.expected.unit); });
  if (dimensionOf(input.expectedResult.unit) !== input.dimension || input.plausibility.min > input.plausibility.max) throw new CalculationError("CALCULATION_INVALID", "Result dimension or plausibility bounds are invalid.");
  finite(input.expectedResult.value, "expectedResult"); finite(input.plausibility.min, "plausibility.min"); finite(input.plausibility.max, "plausibility.max");
  return Object.freeze({ ...input, inputs: Object.freeze([...input.inputs]), steps: Object.freeze([...input.steps]) });
}

const close = (actual: number, expected: number, tolerance: number) => Math.abs(actual - expected) <= tolerance;
export function evaluateCalculation(exercise: CalculationExerciseVersion, submission: CalculationSubmission): CalculationEvaluation {
  const observations: CalculationObservation[] = [];
  if (submission.steps.length !== exercise.steps.length) observations.push({ step: null, parentCategory: "ERR-CALC", category: "FORMULA", critical: false, message: "Expected calculation steps are missing." });
  exercise.steps.forEach((expected, index) => {
    const actual = submission.steps[index]; if (!actual) return;
    try { const converted = convert(actual, expected.expected.unit); if (!close(converted.value, expected.expected.value, exercise.tolerance)) observations.push({ step: expected.position, parentCategory: "ERR-CALC", category: "ARITHMETIC", critical: false, message: "Step result is incorrect." }); }
    catch { observations.push({ step: expected.position, parentCategory: "ERR-CALC", category: "DIMENSION", critical: true, message: "Step unit is dimensionally incompatible." }); }
  });
  let dimensionValid = true; let normalized = Number.NaN;
  try { dimensionValid = dimensionOf(submission.result.unit) === exercise.dimension; normalized = convert(submission.result, exercise.expectedResult.unit).value; }
  catch { dimensionValid = false; observations.push({ step: null, parentCategory: "ERR-CALC", category: "DIMENSION", critical: true, message: "Final result is dimensionally incompatible." }); }
  const plausible = dimensionValid && normalized >= exercise.plausibility.min && normalized <= exercise.plausibility.max;
  if (dimensionValid && !plausible) observations.push({ step: null, parentCategory: "ERR-CALC", category: "PLAUSIBILITY", critical: true, message: "Final result is implausible." });
  if (dimensionValid && plausible && !close(normalized, exercise.expectedResult.value, exercise.tolerance)) observations.push({ step: null, parentCategory: "ERR-CALC", category: "ARITHMETIC", critical: false, message: "Final numeric result is incorrect." });
  const critical = observations.some((item) => item.critical); const correct = observations.length === 0;
  return Object.freeze({ correct, dimensionValid, plausible, mastered: correct && !critical, observations: Object.freeze(observations), remediation: Object.freeze({ required: !correct, priority: critical ? "CRITICAL" : "NORMAL", destination: "CALCULATIONS_LAB", focus: Object.freeze(["DIMENSIONAL_VERIFICATION", "TARGETED_PRACTICE"]) }) });
}
