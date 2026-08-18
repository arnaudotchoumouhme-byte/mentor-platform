import { describe, expect, it } from "vitest";
import { evaluateRuntimeReadiness } from "./runtime-readiness";

const ready = { persistentStorageReady: true, databaseAvailable: true, schemaVersion: 13, targetVersion: 13, pendingMigrations: 0, schemaValid: true, auth0Configured: true, aiConfigured: false };
describe("runtime readiness", () => {
  it("is ready when every indispensable component is ready", () => { const result = evaluateRuntimeReadiness(ready); expect(result.status).toBe("ready"); expect(result.checks.ai).toBe("disabled"); });
  it.each(["persistentStorageReady", "databaseAvailable", "schemaValid", "auth0Configured"] as const)("fails closed when %s is false", key => { expect(evaluateRuntimeReadiness({ ...ready, [key]: false }).status).toBe("not-ready"); });
  it("reports schema and pending migration mismatches", () => { const result = evaluateRuntimeReadiness({ ...ready, schemaVersion: 12, pendingMigrations: 1 }); expect(result.status).toBe("not-ready"); expect(result.checks.schema.status).toBe("not-ready"); expect(result.checks.migrations.pending).toBe(1); });
});
