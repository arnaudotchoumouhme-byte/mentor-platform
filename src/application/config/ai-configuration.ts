export type AiConfiguration = Readonly<{
  apiKey: string | undefined;
  dailyBudgetCad: number;
}>;

export interface AiConfigurationPort {
  load(): AiConfiguration;
}
