import { coreMigrationRegistry as historicalMigrationRegistry } from "./definitions/mig-0001-core-baseline";
import { mcqContentImportMigration } from "./definitions/mig-0014-mcq-content-import";
import { sourceVersionEditorialAliasMigration } from "./definitions/mig-0015-source-version-editorial-alias";
import { learnerDataIsolationMigration } from "./definitions/mig-0016-learner-data-isolation";
import { MigrationRegistry } from "./migration-registry";

export const coreMigrationRegistry = new MigrationRegistry([
  ...historicalMigrationRegistry.migrations,
  mcqContentImportMigration,
  sourceVersionEditorialAliasMigration,
  learnerDataIsolationMigration,
]);
