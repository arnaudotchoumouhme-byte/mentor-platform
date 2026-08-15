import type { CanadianProvince, Jurisdiction, PracticeRule, PracticeRuleVersion } from "@/domain/canadian-practice";

export interface CanadianPracticeRepository {
  insertRule(rule: PracticeRule): Promise<void>;
  insertRuleVersion(version: PracticeRuleVersion): Promise<void>;
  findRule(practiceRuleId: string): Promise<PracticeRule | null>;
  findVersion(practiceRuleId: string, ruleVersion: number): Promise<PracticeRuleVersion | null>;
  listHistory(practiceRuleId: string): Promise<readonly PracticeRuleVersion[]>;
  resolveActive(input: Readonly<{ practiceRuleId: string; jurisdiction: Jurisdiction; province: CanadianProvince | null; at: string }>): Promise<PracticeRuleVersion | null>;
  findSourceDisplay(sourceVersionId: string): Promise<CanadianPracticeSourceDisplay | null>;
}

export type CanadianPracticeSourceDisplay = Readonly<{ sourceId: string; sourceVersionId: string; sourceVersion: number; displayName: string; provenanceType: string }>;
export type CanadianPracticeEvent = Readonly<{ name: "canadian_practice.rule_version_loaded" | "canadian_practice.rule_query_completed" | "canadian_practice.rule_query_rejected"; traceId: string; status: "success" | "failure"; context: Readonly<Record<string, unknown>> }>;
export interface CanadianPracticeLogger { event(event: CanadianPracticeEvent): void; }
