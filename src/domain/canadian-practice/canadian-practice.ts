import { AppError } from "@/shared/errors/app-error";

export type Jurisdiction = "FEDERAL" | "PROVINCIAL";
export type CanadianProvince = "ON" | "QC";
export type PracticeRuleStatus = "DRAFT" | "ACTIVE" | "RETIRED";

export type PracticeRule = Readonly<{
  practiceRuleId: string;
  code: string;
  learningObjectiveId: string;
}>;

export type PracticeRuleVersion = Readonly<{
  id: string;
  practiceRuleId: string;
  ruleVersion: number;
  jurisdiction: Jurisdiction;
  province: CanadianProvince | null;
  sourceVersionId: string;
  verifiedAt: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: PracticeRuleStatus;
  pedagogicalSummary: string;
  independenceDisclaimer: string;
  createdAt: string;
}>;

export type CanadianPracticeErrorCode =
  | "CANADIAN_PRACTICE_RULE_INVALID"
  | "CANADIAN_PRACTICE_JURISDICTION_UNSUPPORTED"
  | "CANADIAN_PRACTICE_SOURCE_REQUIRED"
  | "CANADIAN_PRACTICE_VERSION_NOT_FOUND"
  | "CANADIAN_PRACTICE_RULE_NOT_EFFECTIVE";

export class CanadianPracticeError extends AppError {
  constructor(code: CanadianPracticeErrorCode, internalMessage: string, context: Readonly<Record<string, unknown>> = {}) {
    super({ code, userMessage: "La règle de pratique canadienne demandée ne peut pas être utilisée.", internalMessage, category: "validation", context });
    this.name = "CanadianPracticeError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id = (value: string, field: string): string => {
  if (!UUID.test(value)) throw new CanadianPracticeError("CANADIAN_PRACTICE_RULE_INVALID", `${field} must be a UUID.`);
  return value;
};
const text = (value: string, field: string, code: CanadianPracticeErrorCode = "CANADIAN_PRACTICE_RULE_INVALID"): string => {
  const normalized = value.trim();
  if (!normalized) throw new CanadianPracticeError(code, `${field} is required.`);
  return normalized;
};
const instant = (value: string, field: string): string => {
  if (!value || !Number.isFinite(Date.parse(value))) throw new CanadianPracticeError("CANADIAN_PRACTICE_RULE_INVALID", `${field} must be an ISO date.`);
  return value;
};

export function definePracticeRule(input: PracticeRule): PracticeRule {
  return Object.freeze({
    practiceRuleId: id(input.practiceRuleId, "practiceRuleId"),
    code: text(input.code, "code"),
    learningObjectiveId: id(input.learningObjectiveId, "learningObjectiveId"),
  });
}

export function definePracticeRuleVersion(input: PracticeRuleVersion): PracticeRuleVersion {
  if (!Number.isInteger(input.ruleVersion) || input.ruleVersion < 1) throw new CanadianPracticeError("CANADIAN_PRACTICE_RULE_INVALID", "ruleVersion must be positive.");
  if (input.jurisdiction === "FEDERAL" && input.province !== null) throw new CanadianPracticeError("CANADIAN_PRACTICE_JURISDICTION_UNSUPPORTED", "Federal rules cannot specify a province.");
  if (input.jurisdiction === "PROVINCIAL" && input.province !== "ON" && input.province !== "QC") throw new CanadianPracticeError("CANADIAN_PRACTICE_JURISDICTION_UNSUPPORTED", "Only Ontario and Quebec are configured.");
  const effectiveFrom = instant(input.effectiveFrom, "effectiveFrom");
  const effectiveTo = input.effectiveTo === null ? null : instant(input.effectiveTo, "effectiveTo");
  if (effectiveTo && Date.parse(effectiveTo) <= Date.parse(effectiveFrom)) throw new CanadianPracticeError("CANADIAN_PRACTICE_RULE_INVALID", "Effective window is invalid.");
  return Object.freeze({
    ...input,
    id: id(input.id, "id"), practiceRuleId: id(input.practiceRuleId, "practiceRuleId"),
    sourceVersionId: id(input.sourceVersionId, "sourceVersionId"),
    verifiedAt: instant(input.verifiedAt, "verifiedAt"), effectiveFrom, effectiveTo,
    pedagogicalSummary: text(input.pedagogicalSummary, "pedagogicalSummary"),
    independenceDisclaimer: text(input.independenceDisclaimer, "independenceDisclaimer"),
    createdAt: instant(input.createdAt, "createdAt"),
  });
}

export function isPracticeRuleVersionEffective(version: PracticeRuleVersion, at: string): boolean {
  const timestamp = Date.parse(instant(at, "at"));
  return version.status === "ACTIVE" && timestamp >= Date.parse(version.effectiveFrom) && (version.effectiveTo === null || timestamp < Date.parse(version.effectiveTo));
}
