import type { CatalogRepository } from "@/application/mle/catalog-ports";
import { validateCatalog, type Blueprint, type Catalog, type ConceptDependency, type ConceptVersion, type ResourceLink } from "@/domain/mle/catalog";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";
import { SqliteNativeCatalogResources } from "./sqlite-native-resources";

type ConceptRow = { concept_id: string; version: number; title: string; priority: ConceptVersion["priority"]; blueprint_id: string; status: ConceptVersion["status"]; provenance: string; created_at: string; author_id: string; reviewed_at: string | null; reviewer_id: string | null };
export class SqliteCatalogRepository implements CatalogRepository {
  constructor(private readonly database: SqliteExecutor) {}
  read(): Catalog | null {
    const bp = this.database.all<{ id: string; version: string; effective_from: string; source_url: string }>("SELECT * FROM mle_blueprints ORDER BY effective_from DESC,id LIMIT 1")[0];
    if (!bp) return null;
    const categories = this.database.all<{ code: string; label: string; total: number; mcq: number; osce: number }>("SELECT code,label,total,mcq,osce FROM mle_categories WHERE blueprint_id=? ORDER BY code", bp.id).map(category => ({ ...category,
      competencies: this.database.all<{ code: string }>("SELECT code FROM mle_competencies WHERE blueprint_id=? AND category_code=? ORDER BY code", bp.id, category.code).map(value => value.code),
    }));
    const blueprint: Blueprint = { id: bp.id, version: bp.version, effectiveFrom: bp.effective_from, sourceUrl: bp.source_url, categories };
    const concepts = this.database.all<ConceptRow>("SELECT * FROM mle_concepts WHERE blueprint_id=? ORDER BY concept_id,version", bp.id).map((row): ConceptVersion => ({
      conceptId: row.concept_id, version: row.version, title: row.title, priority: row.priority, blueprintId: row.blueprint_id, status: row.status, provenance: row.provenance, createdAt: row.created_at, authorId: row.author_id, reviewedAt: row.reviewed_at, reviewerId: row.reviewer_id,
      competencyCodes: this.database.all<{ competency_code: string }>("SELECT competency_code FROM mle_concept_mappings WHERE concept_id=? AND concept_version=? ORDER BY competency_code", row.concept_id, row.version).map(value => value.competency_code),
      resources: this.database.all<ResourceLink>("SELECT kind,label,target_id AS targetId,target_version AS targetVersion,provenance FROM mle_resource_links WHERE concept_id=? AND concept_version=? ORDER BY position", row.concept_id, row.version),
    }));
    const dependencies = this.database.all<ConceptDependency>("SELECT d.from_id AS fromId,d.from_version AS fromVersion,d.to_id AS toId,d.to_version AS toVersion,d.relation,d.provenance,d.created_at AS createdAt FROM mle_dependencies d JOIN mle_concepts c ON c.concept_id=d.from_id AND c.version=d.from_version WHERE c.blueprint_id=? ORDER BY d.from_id,d.from_version,d.to_id,d.to_version,d.relation", bp.id);
    return validateCatalog({ blueprint, concepts, dependencies });
  }
  saveDraft(catalog: Catalog): void {
    if (catalog.concepts.some(value => value.status !== "DRAFT" || value.reviewedAt || value.reviewerId)) throw new Error("Only unreviewed drafts may be saved in LOT 9");
    this.database.run("BEGIN IMMEDIATE");
    try {
      const current = this.read();
      const bp = catalog.blueprint;
      const canonical = (value: Blueprint) => JSON.stringify({ ...value, categories: [...value.categories].sort((a, b) => a.code.localeCompare(b.code)).map(c => ({ ...c, competencies: [...c.competencies].sort() })) });
      if (current && canonical(current.blueprint) !== canonical(bp)) throw new Error("Blueprint is immutable; this repository handles one blueprint release");
      if (!current) {
        this.database.run("INSERT INTO mle_blueprints VALUES(?,?,?,?,?,?)", bp.id, bp.version, bp.effectiveFrom, bp.sourceUrl, catalog.concepts[0]?.createdAt ?? "2026-09-08T00:00:00.000Z", "PEBC official reference; MLE-01");
        for (const category of bp.categories) {
          this.database.run("INSERT INTO mle_categories VALUES(?,?,?,?,?,?)", bp.id, category.code, category.label, category.total, category.mcq, category.osce);
          for (const code of category.competencies) this.database.run("INSERT INTO mle_competencies VALUES(?,?,?)", bp.id, code, category.code);
        }
      }
      const combined = { blueprint: bp, concepts: [...(current?.concepts ?? []), ...catalog.concepts], dependencies: [...(current?.dependencies ?? []), ...catalog.dependencies] };
      validateCatalog(combined);
      const resources = new SqliteNativeCatalogResources(this.database);
      for (const concept of catalog.concepts) {
        const max = Math.max(0, ...(current?.concepts ?? []).filter(value => value.conceptId === concept.conceptId).map(value => value.version));
        if (concept.version !== max + 1) throw new Error("Concept versions must be contiguous and immutable");
        this.database.run("INSERT INTO mle_concepts VALUES(?,?,?,?,?,?,?,?,?,?,?)", concept.conceptId, concept.version, concept.title, concept.priority, concept.blueprintId, concept.status, concept.provenance, concept.createdAt, concept.authorId, concept.reviewedAt, concept.reviewerId);
        for (const code of concept.competencyCodes) this.database.run("INSERT INTO mle_concept_mappings VALUES(?,?,?,?)", concept.conceptId, concept.version, bp.id, code);
        concept.resources.forEach((link, position) => {
          if (link.targetId && !resources.isResolvable(link)) throw new Error("Unresolved native reference");
          this.database.run("INSERT INTO mle_resource_links(concept_id,concept_version,position,kind,label,target_id,target_version,provenance) VALUES(?,?,?,?,?,?,?,?)", concept.conceptId, concept.version, position, link.kind, link.label, link.targetId, link.targetVersion, link.provenance);
        });
      }
      for (const edge of catalog.dependencies) this.database.run("INSERT INTO mle_dependencies VALUES(?,?,?,?,?,?,?)", edge.fromId, edge.fromVersion, edge.toId, edge.toVersion, edge.relation, edge.provenance, edge.createdAt);
      this.database.run("COMMIT");
    } catch (error) { this.database.run("ROLLBACK"); throw error; }
  }
}
