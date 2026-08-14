import "server-only";
import { randomUUID } from "node:crypto";
import { CreateMcqSession } from "@/application/mcq/create-mcq-session";
import { SubmitMcqAnswer } from "@/application/mcq/submit-mcq-answer";
import { CompleteMcqSession } from "@/application/mcq/complete-mcq-session";
import { GetMcqSession } from "@/application/mcq/get-mcq-session";
import type { McqEvent } from "@/application/mcq/mcq-ports";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";
import { structuredLogger } from "@/infrastructure/observability/structured-logger";
import { SqliteMcqRepository } from "./sqlite-mcq-repository";

const repository = new SqliteMcqRepository(sqliteExecutor);
const ids = { next: () => randomUUID() }; const clock = { now: () => new Date().toISOString() };
const logger = { event: (event: McqEvent) => structuredLogger.log({ level: event.status === "failure" ? "error" : event.status === "degraded" ? "warn" : "info", module: "mcq", operation: event.name, status: event.status, message: event.name, traceId: event.traceId, context: { sessionId: event.sessionId, ...event.context } }) };
export const mcqServices = Object.freeze({ create: new CreateMcqSession(repository, ids, clock, logger), submit: new SubmitMcqAnswer(repository, clock, logger), complete: new CompleteMcqSession(repository, clock, logger), get: new GetMcqSession(repository) });
