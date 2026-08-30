import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const runnerPath = path.join(scriptDirectory, "run-tsx.mjs");

test("the guarded userInfo fallback lets tsx and its child process start", () => {
  const result = spawnSync(
    process.execPath,
    [runnerPath, "--eval", "console.log('tsx-child-ok')"],
    { cwd: projectRoot, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /tsx-child-ok/);
});
