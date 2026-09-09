import type { Catalog, ResourceLink } from "@/domain/mle/catalog";

export interface CatalogRepository {
  read(): Catalog | null;
  /** Only new immutable DRAFT versions; no publication capability in LOT 9. */
  saveDraft(catalog: Catalog): void;
}
export interface NativeCatalogResources {
  isResolvable(link: ResourceLink): boolean;
}
