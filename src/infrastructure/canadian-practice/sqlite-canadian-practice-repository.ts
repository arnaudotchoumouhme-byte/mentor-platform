import type { CanadianPracticeRepository, CanadianPracticeSourceDisplay } from "@/application/canadian-practice/canadian-practice-ports";
import { CanadianPracticeError, definePracticeRule, definePracticeRuleVersion, type CanadianProvince, type Jurisdiction, type PracticeRule, type PracticeRuleVersion } from "@/domain/canadian-practice";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";

type RuleRow = Readonly<{ practice_rule_id: string; code: string; learning_objective_id: string }>;
type VersionRow = Readonly<{ practice_rule_version_id: string; practice_rule_id: string; rule_version: number; jurisdiction: Jurisdiction; province: CanadianProvince | null; source_version_id: string; verified_at: string; effective_from: string; effective_to: string | null; status: PracticeRuleVersion["status"]; pedagogical_summary: string; independence_disclaimer: string; created_at: string }>;

const mapRule = (row: RuleRow): PracticeRule => definePracticeRule({ practiceRuleId: row.practice_rule_id, code: row.code, learningObjectiveId: row.learning_objective_id });
const mapVersion = (row: VersionRow): PracticeRuleVersion => definePracticeRuleVersion({ id: row.practice_rule_version_id, practiceRuleId: row.practice_rule_id, ruleVersion: row.rule_version, jurisdiction: row.jurisdiction, province: row.province, sourceVersionId: row.source_version_id, verifiedAt: row.verified_at, effectiveFrom: row.effective_from, effectiveTo: row.effective_to, status: row.status, pedagogicalSummary: row.pedagogical_summary, independenceDisclaimer: row.independence_disclaimer, createdAt: row.created_at });
const VERSION_COLUMNS = "practice_rule_version_id,practice_rule_id,rule_version,jurisdiction,province,source_version_id,verified_at,effective_from,effective_to,status,pedagogical_summary,independence_disclaimer,created_at";

export class SqliteCanadianPracticeRepository implements CanadianPracticeRepository {
  constructor(private readonly database: SqliteExecutor) {}

  async insertRule(rule: PracticeRule): Promise<void> {
    const value = definePracticeRule(rule);
    const canObjective = this.database.all<{ present: number }>("SELECT 1 AS present FROM learning_objectives o JOIN curriculum_units u ON u.unit_id=o.unit_id JOIN curriculum_blocks b ON b.block_id=u.block_id WHERE o.learning_objective_id=? AND b.code='CAN'", value.learningObjectiveId)[0];
    if (!canObjective) throw new CanadianPracticeError("CANADIAN_PRACTICE_RULE_INVALID", "Learning objective must belong to the Foundation CAN block.");
    this.database.run("INSERT INTO canadian_practice_rules(practice_rule_id,code,learning_objective_id) VALUES(?,?,?)", value.practiceRuleId, value.code, value.learningObjectiveId);
  }

  async insertRuleVersion(version: PracticeRuleVersion): Promise<void> {
    const value = definePracticeRuleVersion(version);
    this.database.run("INSERT INTO canadian_practice_rule_versions(practice_rule_version_id,practice_rule_id,rule_version,jurisdiction,province,source_version_id,verified_at,effective_from,effective_to,status,pedagogical_summary,independence_disclaimer,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)", value.id, value.practiceRuleId, value.ruleVersion, value.jurisdiction, value.province, value.sourceVersionId, value.verifiedAt, value.effectiveFrom, value.effectiveTo, value.status, value.pedagogicalSummary, value.independenceDisclaimer, value.createdAt);
  }

  async findRule(practiceRuleId: string): Promise<PracticeRule | null> {
    const row = this.database.all<RuleRow>("SELECT practice_rule_id,code,learning_objective_id FROM canadian_practice_rules WHERE practice_rule_id=?", practiceRuleId)[0];
    return row ? mapRule(row) : null;
  }

  async findVersion(practiceRuleId: string, ruleVersion: number): Promise<PracticeRuleVersion | null> {
    const row = this.database.all<VersionRow>(`SELECT ${VERSION_COLUMNS} FROM canadian_practice_rule_versions WHERE practice_rule_id=? AND rule_version=?`, practiceRuleId, ruleVersion)[0];
    return row ? mapVersion(row) : null;
  }

  async listHistory(practiceRuleId: string): Promise<readonly PracticeRuleVersion[]> {
    return Object.freeze(this.database.all<VersionRow>(`SELECT ${VERSION_COLUMNS} FROM canadian_practice_rule_versions WHERE practice_rule_id=? ORDER BY rule_version`, practiceRuleId).map(mapVersion));
  }

  async resolveActive(input: Readonly<{ practiceRuleId: string; jurisdiction: Jurisdiction; province: CanadianProvince | null; at: string }>): Promise<PracticeRuleVersion | null> {
    if ((input.jurisdiction === "FEDERAL" && input.province !== null) || (input.jurisdiction === "PROVINCIAL" && input.province !== "ON" && input.province !== "QC")) throw new CanadianPracticeError("CANADIAN_PRACTICE_JURISDICTION_UNSUPPORTED", "Jurisdiction and province are not configured.");
    const row = this.database.all<VersionRow>(`SELECT ${VERSION_COLUMNS} FROM canadian_practice_rule_versions WHERE practice_rule_id=? AND jurisdiction=? AND province IS ? AND status='ACTIVE' AND effective_from<=? AND (effective_to IS NULL OR effective_to>?) ORDER BY rule_version DESC LIMIT 1`, input.practiceRuleId, input.jurisdiction, input.province, input.at, input.at)[0];
    return row ? mapVersion(row) : null;
  }

  async findSourceDisplay(sourceVersionId: string): Promise<CanadianPracticeSourceDisplay | null> {
    return this.database.all<CanadianPracticeSourceDisplay>("SELECT s.source_id AS sourceId,v.source_version_id AS sourceVersionId,v.version AS sourceVersion,s.display_name AS displayName,s.provenance_type AS provenanceType FROM source_versions v JOIN sources s ON s.source_id=v.source_id WHERE v.source_version_id=?", sourceVersionId)[0] ?? null;
  }
}
