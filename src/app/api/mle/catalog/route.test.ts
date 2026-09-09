import { describe, expect, it, vi } from "vitest";
import { createCatalogGet } from "./catalog-handler";
import { mleCatalogEnabled } from "@/infrastructure/mle/catalog-feature";
import { AppError } from "@/shared/errors/app-error";

describe("MLE catalog read-only boundary", () => {
  it("is off by default and does not load identity or database", async () => {
    const authorize = vi.fn(); const load = vi.fn();
    for (const value of [undefined, "0", "true", "yes"]) {
      const response = await createCatalogGet(() => mleCatalogEnabled({ MENTOR_MLE_CATALOG_ENABLED: value }), authorize, load)(new Request("http://localhost/api/mle/catalog"));
      expect(response.status).toBe(404); expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(authorize).not.toHaveBeenCalled(); expect(load).not.toHaveBeenCalled();
    expect(mleCatalogEnabled({ MENTOR_MLE_CATALOG_ENABLED: "1" })).toBe(true);
  });
  it("checks editorial access before reading drafts", async () => {
    const load = vi.fn();
    const response = await createCatalogGet(() => true, async () => { throw new AppError({ code: "PILOT_ACCESS_DENIED", userMessage: "Refusé", category: "security" }); }, load)(new Request("http://localhost/api/mle/catalog"));
    expect(response.status).toBe(403); expect(load).not.toHaveBeenCalled();
  });
  it("returns an empty catalog without seeding or collecting learner data", async () => {
    const execute = vi.fn(() => null);
    const response = await createCatalogGet(() => true, async () => undefined, async () => ({ execute }))(new Request("http://localhost/api/mle/catalog"));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ success: true, data: null });
  });
});
