import type { NativeCatalogResources } from "@/application/mle/catalog-ports";
import type { ResourceLink } from "@/domain/mle/catalog";
import type { SqliteExecutor } from "@/infrastructure/database/sqlite/sqlite-executor";

export class SqliteNativeCatalogResources implements NativeCatalogResources {
  constructor(private readonly database: SqliteExecutor) {}
  isResolvable(link: ResourceLink): boolean {
    if (!link.targetId || !link.targetVersion) return false;
    const args = [link.targetId, link.targetVersion];
    switch (link.kind) {
      case "LEARNING_OBJECTIVE": return this.database.all("SELECT o.learning_objective_id FROM learning_objectives o JOIN curriculum_units u ON u.unit_id=o.unit_id JOIN curriculum_blocks b ON b.block_id=u.block_id WHERE o.learning_objective_id=? AND b.curriculum_version_id=?", ...args).length === 1;
      case "CHAPTER": return this.database.all("SELECT u.unit_id FROM curriculum_units u JOIN curriculum_blocks b ON b.block_id=u.block_id WHERE u.unit_id=? AND b.curriculum_version_id=?", ...args).length === 1;
      case "SOURCE": return this.database.all("SELECT v.source_version_id FROM source_versions v JOIN sources s ON s.source_id=v.source_id WHERE v.source_version_id=? AND v.source_version_id=? AND s.status='READY' AND s.version=v.version AND v.extraction_status='COMPLETED'", ...args).length === 1;
      case "QUESTION": return this.database.all("SELECT item_id FROM mcq_question_versions WHERE item_id=? AND CAST(version AS TEXT)=?", ...args).length === 1;
      case "CASE": return this.database.all("SELECT station_version_id FROM osce_station_versions WHERE station_version_id=? AND CAST(version AS TEXT)=?", ...args).length === 1;
      // Personal cards have no immutable native version. Do not invent one or read their content.
      case "FLASHCARD": return false;
    }
  }
}
