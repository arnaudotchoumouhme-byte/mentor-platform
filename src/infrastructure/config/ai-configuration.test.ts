import { describe, expect, it } from "vitest";
import { createEnvironmentAiConfiguration } from "./ai-configuration";

describe("environment AI configuration", () => {
  it("loads a validated budget without requiring a secret", () => {
    const source = createEnvironmentAiConfiguration(() => ({
      AI_DAILY_BUDGET_CAD: "2.50",
      OPENAI_API_KEY: "",
    }));

    expect(source.load()).toEqual({ apiKey: undefined, dailyBudgetCad: 2.5 });
  });

  it("reads dynamic values on every load", () => {
    let budget = "1";
    const source = createEnvironmentAiConfiguration(() => ({
      AI_DAILY_BUDGET_CAD: budget,
    }));

    expect(source.load().dailyBudgetCad).toBe(1);
    budget = "3";
    expect(source.load().dailyBudgetCad).toBe(3);
  });

  it("uses the default for an empty budget", () => {
    const source = createEnvironmentAiConfiguration(() => ({
      AI_DAILY_BUDGET_CAD: "",
    }));

    expect(source.load().dailyBudgetCad).toBe(2);
  });

  it("rejects a negative budget", () => {
    const source = createEnvironmentAiConfiguration(() => ({
      AI_DAILY_BUDGET_CAD: "-1",
    }));

    expect(() => source.load()).toThrow();
  });
});
