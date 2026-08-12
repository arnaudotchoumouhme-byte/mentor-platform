import type { ClinicalCase, CoachingSession, LearnerSignal, SafetySignal } from "@/domain/coach/clinical-models";
import type { ClinicalEvidenceRule } from "@/domain/coach/medication-review-engine";

export interface CoachingSessionRepository { save(session: CoachingSession): void; find(sessionId: string): CoachingSession | null; }
export interface ClinicalCaseRepository { find(caseId: string): ClinicalCase | null; save(clinicalCase: ClinicalCase): void; }
export interface ClinicalEvidenceService { loadRules(requirements: readonly string[]): Readonly<{ status: "SUFFICIENT" | "INSUFFICIENT" | "CONFLICT"; rules: readonly ClinicalEvidenceRule[]; evidenceRefs: readonly string[]; conflicts: readonly Readonly<{ sourceA: string; sourceB: string; divergence: string }>[] }>; }
export interface LearnerSignalPort { record(sessionId: string, signal: LearnerSignal): void; }
export interface CoachIdentityPort { id(): string; now(): string; }
export interface CoachLoggerPort { event(input: Readonly<{ name: string; traceId: string; sessionId: string; status: "success" | "failure" | "degraded"; context?: Readonly<Record<string, unknown>> }>): void; }
export interface CoachProvider { generateStep(input: Readonly<{ mode: CoachingSession["mode"]; step: CoachingSession["currentStep"]; objective: string; hintLevel: number; safetySignals: readonly SafetySignal[]; evidenceRefs: readonly string[]; evidenceStatus: "SUFFICIENT" | "INSUFFICIENT" | "CONFLICT" }>): CoachStep; }
export type CoachStep = Readonly<{ stepType: CoachingSession["currentStep"]; message: string; question: string | null; hintLevel: number; evidenceRefs: readonly string[]; safetySignals: readonly SafetySignal[]; expectedLearnerAction: string }>;
