import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { isolatedCostPreflight } from "./isolated-openai-cost-policy";
import { extract, measureFullSourcePayload, EXCERPT_PAGES } from "./test-openai-course-isolated";

export const TEST_PDF_PATH = "scripts/fixtures/openai-isolated/PROCESSUS-DE-SOINS-PHARMACEUTIQUES_Cours-Maitre-PEBC.pdf";
export const TEST_PDF_SHA256 = "f6e0e6a5c46a9504719974cf979c18924b612f79bc96697d069e88774aa34bd7";
export function validateTestDispatch(env: Record<string, string | undefined>, checkoutSha: string) {
  if (env.GITHUB_EVENT_NAME !== "workflow_dispatch" || env.GITHUB_REF !== "refs/heads/codex/openai-course-isolated-test" ||
    env.GITHUB_RUN_ATTEMPT !== "1" || !/^[0-9a-f]{40}$/.test(env.EXPECTED_TEST_SHA ?? "") ||
    env.EXPECTED_TEST_SHA !== env.GITHUB_SHA || checkoutSha !== env.GITHUB_SHA) throw new Error("TEST_DISPATCH_INVALID");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    validateTestDispatch(process.env, execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
    const bytes = await readFile(TEST_PDF_PATH);
    if (createHash("sha256").update(bytes).digest("hex") !== TEST_PDF_SHA256) throw new Error("TEST_PDF_MISMATCH");
    const cost = isolatedCostPreflight(process.env);
    const { text, pages } = await extract(bytes);
    const input = await measureFullSourcePayload(text);
    console.log(JSON.stringify({ pdfChecksumMatch: true, pages, excerptPages: EXCERPT_PAGES, input, cost, networkCalls: 0 }));
    if (!input.inputFits) throw new Error("TEST_INPUT_LIMIT");
    if (!cost.allowed) throw new Error("TEST_BUDGET_EXCEEDED");
  } catch {
    console.error("ISOLATED_TEST_PREFLIGHT_BLOCKED: dispatch, PDF or conservative cost check failed. No OpenAI call.");
    process.exitCode = 1;
  }
}
