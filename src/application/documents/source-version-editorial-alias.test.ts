import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/shared/errors/app-error";
import { parseEditorialSourceAlias } from "@/domain/documents/editorial-source-alias";
import { AssociateSourceVersionEditorialAlias, ResolveSourceVersionEditorialAlias } from "./source-version-editorial-alias";
import type { SourceVersionEditorialAliasPort } from "./source-version-editorial-alias-port";

const association = {
  aliasId: "alias-id",
  editorialAlias: parseEditorialSourceAlias("SNC-COURS-2026-04-28/V1"),
  sourceVersionId: "source-version-id",
  createdAt: "2026-08-20T00:00:00.000Z",
  actorId: "operator",
  traceId: "trace-id",
  provenance: "MANUAL_EDITORIAL_ASSOCIATION" as const,
};

describe("source version editorial alias use cases", () => {
  it("associates canonical input with generated trace metadata", async () => {
    const repository: SourceVersionEditorialAliasPort = { associate: vi.fn(async record => ({ status: "CREATED" as const, association: record })), resolve: vi.fn() };
    const result = await new AssociateSourceVersionEditorialAlias(repository, { generate: () => "alias-id" }, { now: () => association.createdAt }).execute({ editorialAlias: association.editorialAlias, sourceVersionId: association.sourceVersionId, actorId: association.actorId, traceId: association.traceId });
    expect(result).toEqual({ status: "CREATED", association });
  });

  it("returns a resolved UUID and exposes stable validation/not-found codes", async () => {
    const repository: SourceVersionEditorialAliasPort = { associate: vi.fn(), resolve: vi.fn(async alias => alias === association.editorialAlias ? association : null) };
    await expect(new ResolveSourceVersionEditorialAlias(repository).execute({ editorialAlias: association.editorialAlias })).resolves.toEqual(association);
    await expect(new ResolveSourceVersionEditorialAlias(repository).execute({ editorialAlias: "UNKNOWN/V1" })).rejects.toMatchObject({ code: "SOURCE_EDITORIAL_ALIAS_NOT_FOUND" });
    await expect(new ResolveSourceVersionEditorialAlias(repository).execute({ editorialAlias: "invalid" })).rejects.toBeInstanceOf(AppError);
  });
});
