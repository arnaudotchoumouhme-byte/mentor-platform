import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { CourseTraining } from "@/application/mcq/course-training";
import { ImportMcqCorpus } from "@/application/mcq/import-mcq-corpus";
import { aiConfiguration } from "@/infrastructure/config/server-ai-configuration";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";
import { SqliteMcqCorpusWriter } from "./sqlite-mcq-corpus-writer";
import { SqliteCourseTraining } from "./sqlite-course-training";
import { OpenAiCourseGenerator } from "./openai-course-generator";
import { COURSE_COST_POLICY } from "./course-generation-guard";

const importer = new ImportMcqCorpus(new SqliteMcqCorpusWriter(sqliteExecutor), { checksum: value => createHash("sha256").update(value).digest("hex") }, { now: () => new Date().toISOString() });
export const courseTraining = new CourseTraining(new SqliteCourseTraining(sqliteExecutor, importer), new OpenAiCourseGenerator(aiConfiguration, () => COURSE_COST_POLICY.model, undefined, { budgetCad: () => Number(process.env.AI_DAILY_BUDGET_CAD) }), randomUUID);
