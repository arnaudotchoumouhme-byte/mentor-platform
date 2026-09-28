import { expect, it, vi } from "vitest";
import { isolatedCostGuard, prepareIsolatedRequest } from "../../../scripts/isolated-openai-cost-guard";
import { isolatedCostPreflight, measureIsolatedInput, singleAttemptTransport } from "../../../scripts/isolated-openai-cost-policy";

const time = Date.parse("2026-09-27T12:00:00Z");
const env = { OPENAI_MCQ_MODEL: "gpt-5.6-terra", AI_DAILY_BUDGET_CAD: "1" };
const args = () => ["https://api.openai.com/v1/responses", { method: "POST", body: JSON.stringify({
  model: env.OPENAI_MCQ_MODEL, store: false, max_output_tokens: 24000, instructions: "test",
  input: JSON.stringify({ desiredQuestionCount: 2, text: "synthetic" }),
  text: { format: { type: "json_schema", schema: { properties: { questions: { type: "array" } } } } },
}) }] as const;

it("prices the enforced 30000 input limit below one CAD and rejects an insufficient budget", async () => {
  expect(isolatedCostPreflight(env, time)).toMatchObject({ maximumCad: 0.65, allowed: true,
    maxInputTokens: 30000, maxOutputTokens: 6000, usdCadRate: 2, safetyMultiplier: 1.25 });
  const network = vi.fn<typeof fetch>();
  await expect(isolatedCostGuard({ ...env, AI_DAILY_BUDGET_CAD: "0.64" }, network, () => time)(...args())).rejects.toThrow("TEST_BUDGET_EXCEEDED");
  expect(network).not.toHaveBeenCalled();
});
it("counts UTF-8 bytes, includes the framing reserve and refuses a single byte over the limit", () => {
  expect(measureIsolatedInput("x".repeat(21808))).toMatchObject({ inputTokenUpperEstimate: 30000, inputFits: true });
  expect(measureIsolatedInput("x".repeat(21809))).toMatchObject({ inputTokenUpperEstimate: 30001, inputFits: false });
  expect(measureIsolatedInput("é")).toMatchObject({ requestBytes: 2, inputTokenUpperEstimate: 8194 });
});
it("rejects an oversized full payload before invoking the network", async () => {
  const [url, init] = args();
  const network = vi.fn<typeof fetch>();
  const body = { ...JSON.parse(init.body), instructions: "x".repeat(21808) };
  await expect(isolatedCostGuard(env, network, () => time)(url, { ...init, body: JSON.stringify(body) })).rejects.toThrow("TEST_INPUT_LIMIT");
  expect(network).not.toHaveBeenCalled();
});
it.each(["NaN", "Infinity", "0", "-1", "2"])("blocks invalid budget %s", budget => {
  expect(() => isolatedCostPreflight({ ...env, AI_DAILY_BUDGET_CAD: budget }, time)).toThrow("TEST_BUDGET_INVALID");
});
it("cannot substitute an unproven cheap env rate card or another model", () => {
  expect(() => isolatedCostPreflight({ ...env, OPENAI_TEST_COST_BASIS: '{"boundsVerified":true}' }, time)).toThrow("TEST_COST_UNKNOWN");
  expect(() => isolatedCostPreflight({ ...env, OPENAI_MCQ_MODEL: "other" }, time)).toThrow("TEST_COST_UNKNOWN");
});
it.each([NaN, Date.parse("2026-09-26"), Date.parse("2026-09-29")])("fails closed for stale or unknown pricing time", now => {
  expect(() => isolatedCostPreflight(env, now)).toThrow("TEST_COST_UNKNOWN");
});
it("caps output and candidates without a network call", () => {
  const options = prepareIsolatedRequest(...args());
  const body = JSON.parse(options.body);
  expect(body.max_output_tokens).toBe(6000);
  expect(body.text.format.schema.properties.questions).toMatchObject({ minItems: 2, maxItems: 2 });
  expect(body.service_tier).toBe("default");
  expect(body.truncation).toBe("disabled");
  expect(options.redirect).toBe("error");
});
it.each([false, true])("transport never retries after success or failure (%s)", async fail => {
  const network = vi.fn<typeof fetch>();
  if (fail) network.mockRejectedValue(new Error("offline"));
  else network.mockResolvedValue(new Response("{}"));
  const once = singleAttemptTransport(network);
  if (fail) await expect(once(...args())).rejects.toThrow("offline");
  else await once(...args());
  await expect(once(...args())).rejects.toThrow("TEST_CALL_LIMIT");
  expect(network).toHaveBeenCalledTimes(1);
});
it("rejects oversize payload, extra tools, other model and candidate counts", () => {
  const [url, init] = args();
  for (const patch of [{ input: JSON.stringify({ desiredQuestionCount: 2, text: "x".repeat(180001) }) },
    { model: "other" }, { tools: [] }, { input: JSON.stringify({ desiredQuestionCount: 3 }) }]) {
    expect(() => prepareIsolatedRequest(url, { ...init, body: JSON.stringify({ ...JSON.parse(init.body), ...patch }) })).toThrow();
  }
});
