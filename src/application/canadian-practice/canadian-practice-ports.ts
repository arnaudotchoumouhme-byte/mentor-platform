import type { Jurisdiction, PracticeRule, PracticeRuleVersion } from "@/domain/canadian-practice";

export interface CanadianPracticeRepository {
  insertRule(rule: PracticeRule): Promise<void>;
  insertRuleVersion(version: PracticeRuleVersion): Promise<void>;
  findRule(practiceRuleId: string): Promise<PracticeRule | null>;
  findVersion(practiceRuleId: string, ruleVersion: number): Promise<PracticeRuleVersion | null>;
  listHistory(practiceRuleId: string): Promise<readonly PracticeRuleVersion[]>;
  resolveActive(input: Readonly<{ practiceRuleId: string; jurisdiction: Jurisdiction; province: "ON" | null; at: string }>): Promise<PracticeRuleVersion | null>;
}
