import "server-only";
import { CanadianPracticeQueries } from "@/application/canadian-practice/canadian-practice-queries";
import type { CanadianPracticeEvent } from "@/application/canadian-practice/canadian-practice-ports";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";
import { structuredLogger } from "@/infrastructure/observability/structured-logger";
import { SqliteCanadianPracticeRepository } from "./sqlite-canadian-practice-repository";

const repository = new SqliteCanadianPracticeRepository(sqliteExecutor);
const logger = { event: (event: CanadianPracticeEvent) => structuredLogger.log({ level: event.status === "failure" ? "warn" : "info", module: "canadian-practice", operation: event.name, status: event.status, message: event.name, traceId: event.traceId, context: event.context }) };
export const canadianPracticeQueries = new CanadianPracticeQueries(repository, logger);
