import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const shimPath = path.join(scriptDirectory, "tsx-windows-userinfo-shim.cjs");
const tsxCliPath = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
const requireOption = `--require=${JSON.stringify(shimPath)}`;
const nodeOptions = [process.env.NODE_OPTIONS, requireOption]
  .filter(Boolean)
  .join(" ");

const result = spawnSync(process.execPath, [tsxCliPath, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
