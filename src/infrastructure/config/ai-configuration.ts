import { z } from "zod";
import type {
  AiConfiguration,
  AiConfigurationPort,
} from "@/application/config/ai-configuration";

const optionalSecret = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);

const aiEnvironmentSchema = z.object({
  OPENAI_API_KEY: optionalSecret,
  AI_DAILY_BUDGET_CAD: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().finite().nonnegative().default(2),
  ),
});

export function createEnvironmentAiConfiguration(
  readEnvironment: () => Readonly<Record<string, string | undefined>>,
): AiConfigurationPort {
  return {
    load(): AiConfiguration {
      const parsed = aiEnvironmentSchema.parse(readEnvironment());
      return {
        apiKey: parsed.OPENAI_API_KEY,
        dailyBudgetCad: parsed.AI_DAILY_BUDGET_CAD,
      };
    },
  };
}
