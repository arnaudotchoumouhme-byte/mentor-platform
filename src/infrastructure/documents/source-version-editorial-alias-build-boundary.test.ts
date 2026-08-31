import { describe, expect, it, vi } from "vitest";

describe("source version editorial alias build boundary", () => {
  it("loads application, repository and migration definitions without filesystem or database effects", async () => {
    const previousPhase = process.env.NEXT_PHASE;
    process.env.NEXT_PHASE = "phase-production-build";
    const run = vi.fn();
    try {
      const application = await import("@/application/documents/source-version-editorial-alias");
      const infrastructure = await import("./sqlite-source-version-editorial-alias-repository");
      const migration = await import("@/infrastructure/database/sqlite/migrations/definitions/mig-0015-source-version-editorial-alias");
      expect(application.AssociateSourceVersionEditorialAlias).toBeTypeOf("function");
      expect(infrastructure.SqliteSourceVersionEditorialAliasRepository).toBeTypeOf("function");
      expect(migration.sourceVersionEditorialAliasMigration.toVersion).toBe(15);
      expect(run).not.toHaveBeenCalled();
    } finally {
      if (previousPhase === undefined) delete process.env.NEXT_PHASE;
      else process.env.NEXT_PHASE = previousPhase;
    }
  });
});
