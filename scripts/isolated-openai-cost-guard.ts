import { ISOLATED_COST_POLICY as policy, isolatedCostPreflight, singleAttemptTransport } from "./isolated-openai-cost-policy";

export function prepareIsolatedRequest(url: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) {
  if (url !== "https://api.openai.com/v1/responses" || init?.method !== "POST" || typeof init.body !== "string") throw new Error("TEST_REQUEST_INVALID");
  const body = JSON.parse(init.body);
  if (Object.keys(body).some(k => !["model", "store", "max_output_tokens", "instructions", "input", "text"].includes(k)) ||
    body.model !== policy.model || body.store !== false || typeof body.instructions !== "string" || typeof body.input !== "string" ||
    JSON.parse(body.input).desiredQuestionCount !== 2 || body.text?.format?.type !== "json_schema") throw new Error("TEST_REQUEST_INVALID");
  body.max_output_tokens = policy.maxOutputTokens;
  body.service_tier = "default";
  body.truncation = "disabled";
  const questions = body.text.format.schema?.properties?.questions;
  if (questions?.type !== "array") throw new Error("TEST_REQUEST_INVALID");
  questions.minItems = 2;
  questions.maxItems = 2;
  const serialized = JSON.stringify(body);
  if (Buffer.byteLength(serialized, "utf8") > policy.maxRequestBytes) throw new Error("TEST_INPUT_LIMIT");
  return { ...init, body: serialized, redirect: "error" as const };
}

/** No env-provided rate card or unverified character/token ratio can authorize a call. */
export function isolatedCostGuard(env: Record<string, string | undefined>, request: typeof fetch = fetch, now = Date.now): typeof fetch {
  const once = singleAttemptTransport(request);
  return async (url, init) => {
    const options = prepareIsolatedRequest(url, init);
    if (!isolatedCostPreflight(env, now()).allowed) throw new Error("TEST_BUDGET_EXCEEDED");
    return once(url, options);
  };
}
