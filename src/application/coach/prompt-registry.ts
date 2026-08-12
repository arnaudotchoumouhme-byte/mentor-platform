export type PromptDefinition = Readonly<{ promptId: string; promptVersion: number; purpose: string; inputSchema: string; outputSchema: string; owner: string; evaluationSuite: string }>;
export const COACH_PROMPT_REGISTRY: readonly PromptDefinition[] = Object.freeze([
  { promptId: "coach.professor.v1", promptVersion: 1, purpose: "Explication pédagogique", inputSchema: "CoachInputV1", outputSchema: "CoachStepV1", owner: "clinical-education", evaluationSuite: "coach-core-v1" },
  { promptId: "coach.clinical-case.v1", promptVersion: 1, purpose: "Raisonnement sur cas synthétique", inputSchema: "ClinicalCaseV1", outputSchema: "CoachStepV1", owner: "clinical-education", evaluationSuite: "coach-safety-v1" },
  { promptId: "coach.socratic.v1", promptVersion: 1, purpose: "Indices gradués", inputSchema: "CoachInputV1", outputSchema: "CoachStepV1", owner: "learning-science", evaluationSuite: "coach-socratic-v1" },
  { promptId: "coach.teachback.v1", promptVersion: 1, purpose: "Évaluation teach-back", inputSchema: "TeachBackInputV1", outputSchema: "TeachBackResultV1", owner: "learning-science", evaluationSuite: "coach-teachback-v1" },
  { promptId: "coach.case-generator.v1", promptVersion: 1, purpose: "Cas de transfert synthétique", inputSchema: "ClinicalCaseV1", outputSchema: "ClinicalCaseV1", owner: "clinical-education", evaluationSuite: "coach-transfer-v1" },
]);
