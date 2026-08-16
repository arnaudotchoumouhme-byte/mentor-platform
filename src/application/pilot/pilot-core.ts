import { AppError } from "@/shared/errors/app-error";

export type PilotAccount = Readonly<{ accountId: string; oidcSubject: string; learnerId: string; status: "ACTIVE" | "DISABLED"; createdAt: string; updatedAt: string }>;
export type PilotIdentity = Readonly<{ accountId: string; learnerId: string }>;
export type QuotaType = "OSCE_SESSION" | "AI_REQUEST";
export type UsageRecord = Readonly<{ usageId: string; accountId: string; feature: string; provider: string | null; model: string | null; inputUnits: number | null; outputUnits: number | null; estimatedCost: number | null; durationMs: number | null; success: boolean; traceId: string; createdAt: string }>;

export interface PilotRepository {
  findAccountBySubject(subject: string): Promise<PilotAccount | null>;
  consumeQuota(accountId: string, type: QuotaType, now: string): Promise<boolean>;
  appendUsage(record: UsageRecord): Promise<void>;
  listUsage(accountId: string): Promise<readonly UsageRecord[]>;
}

const denied = () => new AppError({ code: "PILOT_ACCESS_DENIED", userMessage: "Accès au pilote refusé.", category: "security" });

export class PilotAccessService {
  constructor(private readonly repository: PilotRepository) {}
  async resolve(subject: string | null): Promise<PilotIdentity> {
    if (!subject) throw new AppError({ code: "UNAUTHORIZED", userMessage: "Authentification requise.", category: "security" });
    const account = await this.repository.findAccountBySubject(subject);
    if (!account || account.status !== "ACTIVE") throw denied();
    return Object.freeze({ accountId: account.accountId, learnerId: account.learnerId });
  }
  async consume(identity: PilotIdentity, type: QuotaType, now: string): Promise<void> {
    if (!await this.repository.consumeQuota(identity.accountId, type, now)) throw new AppError({ code: "PILOT_QUOTA_EXCEEDED", userMessage: "Quota du pilote atteint.", category: "validation" });
  }
  async record(identity: PilotIdentity, input: Omit<UsageRecord, "accountId">): Promise<void> { await this.repository.appendUsage({ ...input, accountId: identity.accountId }); }
  usage(identity: PilotIdentity) { return this.repository.listUsage(identity.accountId); }
}
