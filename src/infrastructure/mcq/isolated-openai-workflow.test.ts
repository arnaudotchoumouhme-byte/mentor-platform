import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { expect, it } from "vitest";
import { TEST_PDF_PATH, TEST_PDF_SHA256, validateTestDispatch } from "../../../scripts/check-openai-test-workflow";

// Reuse ESLint's installed YAML parser; no runtime dependency is added.
const require = createRequire(import.meta.url);
const yaml = createRequire(require.resolve("eslint"))("js-yaml") as { load(text: string): Workflow };
type Workflow = {
  on: Record<string, unknown>; permissions: Record<string, string>;
  jobs: Record<string, { if: string; "runs-on": string; steps: Array<{
    name: string; uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, string>;
  }> }>;
};
const text = readFileSync(".github/workflows/openai-course-isolated.yml", "utf8");
const workflow = yaml.load(text);
const sha = "a".repeat(40);
const context = { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/codex/openai-course-isolated-test",
  GITHUB_RUN_ATTEMPT: "1", EXPECTED_TEST_SHA: sha, GITHUB_SHA: sha };

it("allows only a first manual dispatch of the reviewed SHA on the test branch", () => {
  expect(() => validateTestDispatch(context, sha)).not.toThrow();
  for (const patch of [{ GITHUB_EVENT_NAME: "push" }, { GITHUB_REF: "refs/heads/main" },
    { GITHUB_RUN_ATTEMPT: "2" }, { EXPECTED_TEST_SHA: "main" }, { GITHUB_SHA: "b".repeat(40) }]) {
    expect(() => validateTestDispatch({ ...context, ...patch }, sha)).toThrow("TEST_DISPATCH_INVALID");
  }
  expect(() => validateTestDispatch(context, "b".repeat(40))).toThrow();
});
it("parses as manual-only, ephemeral, read-only checkout, no cached credentials", () => {
  expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
  expect(workflow.permissions).toEqual({ contents: "read" });
  expect(Object.keys(workflow.jobs)).toEqual(["isolated-test"]);
  const job = workflow.jobs["isolated-test"];
  expect(job["runs-on"]).toBe("ubuntu-24.04");
  expect(job.if).toContain("refs/heads/codex/openai-course-isolated-test");
  expect(job.if).toContain("github.run_attempt == 1");
  expect(job.steps[0].with).toMatchObject({ ref: "${{ github.sha }}", "persist-credentials": false });
});
it("exposes only the requested secret, only to the final command after a blocking preflight", () => {
  const steps = workflow.jobs["isolated-test"].steps;
  expect(steps.filter(s => JSON.stringify(s).includes("secrets."))).toEqual([steps.at(-1)]);
  expect(steps.at(-2)?.run).toBe("node scripts/run-tsx.mjs scripts/check-openai-test-workflow.ts");
  expect(steps.at(-1)?.env).toEqual({ OPENAI_API_KEY: "${{ secrets.OPENAI_API_KEY }}", OPENAI_MCQ_MODEL: "gpt-5.6-terra", AI_DAILY_BUDGET_CAD: "1" });
  expect(steps.filter(s => s.run?.includes("--authorize-openai-test"))).toHaveLength(1);
  expect(steps.at(-1)?.run).toContain(TEST_PDF_PATH);
  expect(text).not.toMatch(/continue-on-error|upload-artifact|self-hosted|always\(|secrets\.inherit|DATABASE_URL|RENDER_API_KEY/);
  expect(steps.some(s => s.run?.includes("--ignore-scripts"))).toBe(true);
});
it("bundles only the exact expected PDF bytes without consulting production", () => {
  expect(TEST_PDF_PATH.split("/").at(-1)).toBe("PROCESSUS-DE-SOINS-PHARMACEUTIQUES_Cours-Maitre-PEBC.pdf");
  expect(createHash("sha256").update(readFileSync(TEST_PDF_PATH)).digest("hex")).toBe(TEST_PDF_SHA256);
});
