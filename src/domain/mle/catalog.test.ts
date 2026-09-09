import { describe, expect, it } from "vitest";
import { assertPublicationReady, catalogCoverage, conceptSchema, validateCatalog } from "./catalog";
import { createPilotCatalog } from "@/application/mle/pilot-catalog";

describe("MLE-01 catalog invariants", () => {
  it("preserves all 20 official competencies independent of priorities and content gaps", () => {
    const catalog = createPilotCatalog();
    const before = catalogCoverage(catalog);
    expect(before).toHaveLength(20);
    expect(before.every(row => row.required && row.publishedConcepts === 0)).toBe(true);
    expect(before.some(row => row.mappedConcepts === 0)).toBe(true);
    expect(catalogCoverage({ ...catalog, concepts: catalog.concepts.map(c => ({ ...c, priority: "HIGH-YIELD" })) })).toEqual(before);
    expect(catalog.concepts.every(c => c.status === "DRAFT")).toBe(true);
  });
  it("rejects dangling dependencies, self prerequisites, duplicate edges and cycles", () => {
    const catalog = createPilotCatalog(); const edge = catalog.dependencies[0]!;
    expect(() => validateCatalog({ ...catalog, dependencies: [{ ...edge, toVersion: 99 }] })).toThrow();
    expect(() => validateCatalog({ ...catalog, dependencies: [{ ...edge, toId: edge.fromId }] })).toThrow();
    expect(() => validateCatalog({ ...catalog, dependencies: [edge, edge] })).toThrow();
    expect(() => validateCatalog({ ...catalog, dependencies: [edge, { ...edge, fromId: edge.toId, toId: edge.fromId }] })).toThrow("Cyclic");
    expect(() => validateCatalog({ ...catalog, dependencies: [edge, { ...edge, fromId: edge.toId, toId: edge.fromId, relation: "RELATED_TO" }] })).not.toThrow();
  });
  it("rejects invented competencies and corrupted blueprint weights", () => {
    const catalog = createPilotCatalog();
    expect(() => validateCatalog({ ...catalog, concepts: [{ ...catalog.concepts[0]!, competencyCodes: ["2.1"] }], dependencies: [] })).toThrow("Unknown official");
    expect(() => validateCatalog({ ...catalog, blueprint: { ...catalog.blueprint, categories: catalog.blueprint.categories.map(c => ({ ...c, mcq: 0 })) } })).toThrow();
  });
  it("does not publish pending native links or unreviewed clinical content", () => {
    const concept = createPilotCatalog().concepts[0]!;
    expect(() => assertPublicationReady(concept, [])).toThrow("approval");
    expect(() => conceptSchema.parse({ ...concept, status: "PUBLISHED" })).toThrow();
    expect(() => assertPublicationReady({ ...concept, reviewerId: "editor", reviewedAt: "2026-09-09T00:00:00.000Z" }, [])).toThrow("Unresolved");
    expect(() => conceptSchema.parse({ ...concept, resources: [{ ...concept.resources[0]!, targetId: "x" }] })).toThrow();
  });
  it("counts latest concept versions only and keeps stable IDs", () => {
    const catalog = createPilotCatalog(); const concept = catalog.concepts[0]!;
    expect(createPilotCatalog()).toEqual(catalog);
    expect(catalogCoverage({ ...catalog, concepts: [...catalog.concepts, { ...concept, version: 2 }] })).toEqual(catalogCoverage(catalog));
  });
});
