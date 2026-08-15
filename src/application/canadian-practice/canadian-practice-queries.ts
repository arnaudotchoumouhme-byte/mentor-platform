import { performance } from "node:perf_hooks";
import { CanadianPracticeError, type CanadianProvince, type Jurisdiction, type PracticeRuleVersion } from "@/domain/canadian-practice";
import type { CanadianPracticeLogger, CanadianPracticeRepository, CanadianPracticeSourceDisplay } from "./canadian-practice-ports";

export type PracticeRuleVersionView = Readonly<PracticeRuleVersion & { source: CanadianPracticeSourceDisplay }>;

export class CanadianPracticeQueries {
  constructor(private readonly repository: CanadianPracticeRepository, private readonly logger: CanadianPracticeLogger) {}

  readRule(practiceRuleId: string) { return this.repository.findRule(practiceRuleId); }

  async readVersion(practiceRuleId: string, ruleVersion: number, traceId: string): Promise<PracticeRuleVersionView> {
    const version = await this.repository.findVersion(practiceRuleId, ruleVersion);
    if (!version) return this.reject("CANADIAN_PRACTICE_VERSION_NOT_FOUND", "Rule version was not found.", traceId, { practiceRuleId, ruleVersion });
    return this.withSource(version, traceId);
  }

  async readHistory(practiceRuleId: string, traceId: string): Promise<readonly PracticeRuleVersionView[]> {
    const started = performance.now();
    try {
      const result = await Promise.all((await this.repository.listHistory(practiceRuleId)).map((version) => this.withSource(version, traceId)));
      this.logger.event({ name: "canadian_practice.rule_query_completed", traceId, status: "success", context: { practiceRuleId, resultCount: result.length, duration_ms: Math.round(performance.now() - started) } });
      return Object.freeze(result);
    } catch (error) { this.logRejected(traceId, { practiceRuleId }); throw error; }
  }

  async resolveActive(input: Readonly<{ practiceRuleId: string; jurisdiction: Jurisdiction; province: CanadianProvince | null; at: string; traceId: string }>): Promise<PracticeRuleVersionView> {
    const started = performance.now();
    try {
      const version = await this.repository.resolveActive(input);
      if (!version) return this.reject("CANADIAN_PRACTICE_RULE_NOT_EFFECTIVE", "No effective rule version was found.", input.traceId, { practiceRuleId: input.practiceRuleId, jurisdiction: input.jurisdiction, province: input.province });
      const result = await this.withSource(version, input.traceId);
      this.logger.event({ name: "canadian_practice.rule_query_completed", traceId: input.traceId, status: "success", context: { practiceRuleId: input.practiceRuleId, jurisdiction: input.jurisdiction, province: input.province, ruleVersion: version.ruleVersion, sourceVersionId: version.sourceVersionId, status: version.status, duration_ms: Math.round(performance.now() - started) } });
      return result;
    } catch (error) { this.logRejected(input.traceId, { practiceRuleId: input.practiceRuleId, jurisdiction: input.jurisdiction, province: input.province }); throw error; }
  }

  private async withSource(version: PracticeRuleVersion, traceId: string): Promise<PracticeRuleVersionView> {
    const source = await this.repository.findSourceDisplay(version.sourceVersionId);
    if (!source) return this.reject("CANADIAN_PRACTICE_SOURCE_REQUIRED", "SourceVersion provenance is missing.", traceId, { practiceRuleId: version.practiceRuleId, ruleVersion: version.ruleVersion, sourceVersionId: version.sourceVersionId });
    this.logger.event({ name: "canadian_practice.rule_version_loaded", traceId, status: "success", context: { practiceRuleId: version.practiceRuleId, jurisdiction: version.jurisdiction, province: version.province, ruleVersion: version.ruleVersion, sourceVersionId: version.sourceVersionId, status: version.status } });
    return Object.freeze({ ...version, source });
  }

  private reject(code: "CANADIAN_PRACTICE_SOURCE_REQUIRED" | "CANADIAN_PRACTICE_VERSION_NOT_FOUND" | "CANADIAN_PRACTICE_RULE_NOT_EFFECTIVE", message: string, traceId: string, context: Readonly<Record<string, unknown>>): never {
    this.logRejected(traceId, context); throw new CanadianPracticeError(code, message, context);
  }
  private logRejected(traceId: string, context: Readonly<Record<string, unknown>>): void { this.logger.event({ name: "canadian_practice.rule_query_rejected", traceId, status: "failure", context }); }
}
