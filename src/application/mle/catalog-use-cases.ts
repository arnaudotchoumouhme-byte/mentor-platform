import { catalogCoverage, validateCatalog, type Catalog } from "@/domain/mle/catalog";
import type { CatalogRepository, NativeCatalogResources } from "./catalog-ports";

export class SaveDraftCatalog {
  constructor(private readonly repository: CatalogRepository, private readonly resources: NativeCatalogResources) {}
  execute(input: Catalog): void {
    const current = this.repository.read();
    validateCatalog({ ...input, concepts: [...(current?.concepts ?? []), ...input.concepts], dependencies: [...(current?.dependencies ?? []), ...input.dependencies] });
    if (input.concepts.some(concept => concept.status !== "DRAFT" || concept.reviewedAt || concept.reviewerId)) throw new Error("LOT 9 only imports unreviewed DRAFT content");
    for (const concept of input.concepts) for (const link of concept.resources) {
      if (link.targetId && !this.resources.isResolvable(link)) throw new Error("Native resource cannot be resolved");
    }
    this.repository.saveDraft(input);
  }
}
export class ReadCatalog {
  constructor(private readonly repository: CatalogRepository) {}
  execute() {
    const catalog = this.repository.read();
    return catalog ? { ...catalog, coverage: catalogCoverage(catalog), coverageKind: "EDITORIAL_MAPPING_ONLY" as const } : null;
  }
}
