/** Test-only byte-BPE upper estimate; see the documented framing reserve. */
export const ISOLATED_COST_POLICY = Object.freeze({
  model: "gpt-5.6-terra",
  reviewedAt: "2026-09-27T00:00:00Z",
  expiresAt: "2026-09-29T00:00:00Z",
  maxRequestBytes: 21_808,
  maxInputTokens: 30_000,
  framingTokenReserve: 8192,
  maxOutputTokens: 6000,
  // $2/$12 per million, long-context x2/x1.5, cache-write input x1.25.
  inputUsdPerMillion: 5,
  outputUsdPerMillion: 18,
  usdCadRate: 2,
  safetyMultiplier: 1.25,
});

export function isolatedCostPreflight(env: Record<string, string | undefined>, now = Date.now()) {
  const p = ISOLATED_COST_POLICY;
  if (env.OPENAI_TEST_COST_BASIS !== undefined || env.OPENAI_MCQ_MODEL !== p.model ||
    !Number.isFinite(now) || now < Date.parse(p.reviewedAt) || now >= Date.parse(p.expiresAt)) throw new Error("TEST_COST_UNKNOWN");
  const budget = Number(env.AI_DAILY_BUDGET_CAD);
  if (!Number.isFinite(budget) || budget <= 0 || budget > 1) throw new Error("TEST_BUDGET_INVALID");
  const maximumCad = Math.ceil((p.maxInputTokens * p.inputUsdPerMillion + p.maxOutputTokens * p.outputUsdPerMillion)
    / 1_000_000 * p.usdCadRate * p.safetyMultiplier * 100) / 100;
  return { ...p, maximumCad, budgetCad: budget, allowed: maximumCad < 1 && maximumCad <= budget };
}

/** Byte-level BPE cannot produce more ordinary tokens than source UTF-8 bytes.
 * Count the COMPLETE serialized body (including escaped JSON/schema), not just
 * the PDF. Reserve another 8192 tokens for server framing; never chars / 4.
 * This is a conservative local estimate, not an exact provider token count.
 */
export function measureIsolatedInput(serialized: string) {
  const requestBytes = Buffer.byteLength(serialized, "utf8");
  const inputTokenUpperEstimate = requestBytes + ISOLATED_COST_POLICY.framingTokenReserve;
  return { requestBytes, inputTokenUpperEstimate,
    inputFits: inputTokenUpperEstimate <= ISOLATED_COST_POLICY.maxInputTokens };
}

/** A failed request also consumes the attempt. No redirect or retry. */
export function singleAttemptTransport(request: typeof fetch): typeof fetch {
  let attempted = false;
  return async (url, init) => {
    if (attempted) throw new Error("TEST_CALL_LIMIT");
    attempted = true;
    return request(url, { ...init, redirect: "error" });
  };
}
