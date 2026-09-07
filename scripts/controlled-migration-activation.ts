import { runMigrationOperator } from "../src/infrastructure/database/sqlite/activation/migration-operator-cli";

process.exitCode = await runMigrationOperator(process.argv.slice(2));
