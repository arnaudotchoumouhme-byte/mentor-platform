import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAppConfig } from "@/infrastructure/config/app-config";
import { discoverDatabasePath } from "./database-path-discovery";

describe("discoverDatabasePath", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), "mentor-path-test-")); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it("discovers only metadata for the configured database path", async () => {
    const data = path.join(root, "data");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(data));
    await writeFile(path.join(data, "mentor.db"), "synthetic");
    const result = await discoverDatabasePath(createAppConfig({ NODE_ENV: "test" }, root));
    expect(result).toMatchObject({
      safeDescriptor: "mentor.db",
      exists: true,
      isFile: true,
      sizeBytes: 9,
      readable: true,
    });
    expect(result.resolvedPath).toBe(path.join(data, "mentor.db"));
  });

  it("reports a missing configured database without creating it", async () => {
    const result = await discoverDatabasePath(createAppConfig({ NODE_ENV: "test" }, root));
    expect(result).toMatchObject({ exists: false, readable: false, sizeBytes: null });
  });
});
