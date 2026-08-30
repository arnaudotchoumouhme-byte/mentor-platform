import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnvironment = { ...process.env };

afterEach(async () => {
  process.env = { ...originalEnvironment };
  vi.resetModules();
});

describe("Render build/runtime boundary", () => {
  it("imports /api/actions during the Render build without creating or opening SQLite", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mentor-render-build-"));
    const dataDirectory = path.join(root, "unmounted", "data");
    process.env = {
      ...originalEnvironment,
      NODE_ENV: "production",
      RENDER: "true",
      NEXT_PHASE: "phase-production-build",
      MENTOR_ENABLE_DEMO_DATA: "0",
      MENTOR_DATA_DIRECTORY: dataDirectory,
      AUTH0_DOMAIN: "tenant.auth0.test",
      AUTH0_CLIENT_ID: "test-client",
      AUTH0_CLIENT_SECRET: "test-client-secret",
      AUTH0_SECRET: "12345678901234567890123456789012",
      APP_BASE_URL: "https://mentor.example.test",
      MENTOR_PILOT_PROVISIONER_SUBJECTS: "auth0|test-operator",
      MENTOR_PILOT_OSCE_SESSION_LIMIT: "10",
      MENTOR_PILOT_AI_REQUEST_LIMIT: "10",
      MENTOR_PILOT_QUOTA_WINDOW_DAYS: "30",
      MENTOR_PILOT_AUDIT_KEY: "12345678901234567890123456789012",
    };
    delete process.env.MENTOR_REQUIRE_PERSISTENT_STORAGE;
    delete process.env.MENTOR_PERSISTENT_MOUNT_PATH;

    try {
      await expect(import("@/app/api/actions/route")).resolves.toBeDefined();
      expect(existsSync(dataDirectory)).toBe(false);
      expect(existsSync(path.join(dataDirectory, "mentor.db"))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
