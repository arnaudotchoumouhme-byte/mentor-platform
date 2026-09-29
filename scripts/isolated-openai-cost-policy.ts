import { COURSE_COST_POLICY, assertCourseCost, measureCoursePayload } from "../src/infrastructure/mcq/course-generation-guard";

// Alias, not a second rate card: the application owns pricing and expiry.
export const ISOLATED_COST_POLICY = COURSE_COST_POLICY;
export function isolatedCostPreflight(env: Record<string, string | undefined>, now = Date.now()) {
  const budget = Number(env.AI_DAILY_BUDGET_CAD);
  if (!Number.isFinite(budget) || budget <= 0 || budget > 1) throw new Error("TEST_BUDGET_INVALID");
  if (env.OPENAI_TEST_COST_BASIS !== undefined) throw new Error("TEST_COST_UNKNOWN");
  let maximumCad: number;
  try { maximumCad = assertCourseCost(env.OPENAI_MCQ_MODEL, 1, now); }
  catch { throw new Error("TEST_COST_UNKNOWN"); }
  return { ...COURSE_COST_POLICY, maximumCad, budgetCad: budget, allowed: maximumCad <= budget };
}
export const measureIsolatedInput = measureCoursePayload;
/** A failed request also consumes the attempt. No redirect or retry. */
export function singleAttemptTransport(request: typeof fetch): typeof fetch {
  let attempted = false;
  return async (url, init) => {
    if (attempted) throw new Error("TEST_CALL_LIMIT");
    attempted = true;
    return request(url, { ...init, redirect: "error" });
  };
}
