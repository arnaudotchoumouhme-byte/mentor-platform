import { LocalCourseDiagnostics } from "./local-course-diagnostics";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FreshDatabaseBootstrap } from "../src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap";
import type { SqliteExecutor } from "../src/infrastructure/database/sqlite/sqlite-executor";
import { SqliteCourseTraining } from "../src/infrastructure/mcq/sqlite-course-training";
import { SqliteMcqCorpusWriter } from "../src/infrastructure/mcq/sqlite-mcq-corpus-writer";
import { ImportMcqCorpus } from "../src/application/mcq/import-mcq-corpus";
import { CourseTraining } from "../src/application/mcq/course-training";
import { OpenAiCourseGenerator } from "../src/infrastructure/mcq/openai-course-generator";
import { assertCoursePayload, buildCoursePayload } from "../src/infrastructure/mcq/course-generation-guard";
import { isolatedCostPreflight, singleAttemptTransport } from "./isolated-openai-cost-policy";
import { extract, PDF_NAME, PDF_SHA256 } from "./test-openai-course-isolated";

/** Test-only fixture. No configurable DB path, application bootstrap or production identity. */
export async function runLocalCourseTraining(options: {
  pdf: string; model: string | undefined; budget: string | undefined; authorize: boolean;
  key: () => string | undefined; request: typeof fetch; now?: () => number;
  diagnostics?: LocalCourseDiagnostics;
  review?: (state: ReturnType<CourseTraining["read"]>) => void;
}) {
  const diagnostic = options.diagnostics ?? new LocalCourseDiagnostics();
  diagnostic.stage = "COST_PREFLIGHT";
  const now = options.now ?? Date.now;
  const cost = isolatedCostPreflight({ OPENAI_MCQ_MODEL: options.model, AI_DAILY_BUDGET_CAD: options.budget }, now());
  if (!cost.allowed) throw new Error("TEST_BUDGET_EXCEEDED");
  diagnostic.stage = "PDF_READ";
  if (basename(options.pdf) !== PDF_NAME) throw new Error("TEST_PDF_NAME_MISMATCH");
  const bytes = await readFile(options.pdf);
  diagnostic.stage = "PDF_CHECKSUM";
  if (createHash("sha256").update(bytes).digest("hex") !== PDF_SHA256) throw new Error("TEST_PDF_CHECKSUM_MISMATCH");
  diagnostic.stage = "PDF_EXTRACTION";
  const { text } = await extract(bytes); // Only pages 1–8; no truncation.
  diagnostic.stage = "SQLITE_FIXTURE";
  const sqlite = new DatabaseSync(":memory:");
  try {
    const db: SqliteExecutor = { all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params) as T[], run: (sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).run(...params) };
    new FreshDatabaseBootstrap(db).run();
    sqlite.exec("PRAGMA foreign_keys=ON");
    const learner = "isolated-learner";
    const version = randomUUID();
    sqlite.prepare("INSERT INTO accounts VALUES(?,?,?,?,?,?)").run("isolated-account", "test|isolated", learner, "ACTIVE", "test", "test");
    sqlite.prepare("INSERT INTO documents(id,name,type) VALUES(1,?,'PDF')").run(`${PDF_NAME} — extrait pages 1–8 uniquement`);
    sqlite.prepare("INSERT INTO learner_document_ownership VALUES(1,?)").run(learner);
    sqlite.prepare("INSERT INTO sources(source_id,storage_id,document_id,original_filename,display_name,media_type,extension,size_bytes,checksum,status,extraction_status,version,provenance_type) VALUES('isolated-source','isolated-memory',1,?,?,'application/pdf','pdf',?,?,'READY','COMPLETED',1,'USER_UPLOAD')").run(PDF_NAME, PDF_NAME, bytes.length, PDF_SHA256);
    sqlite.prepare("INSERT INTO source_versions(source_version_id,source_id,version,checksum,extracted_content,extraction_status) VALUES(?,'isolated-source',1,?,?,'COMPLETED')").run(version, PDF_SHA256, text);
    const importer = new ImportMcqCorpus(new SqliteMcqCorpusWriter(db), { checksum: value => createHash("sha256").update(value).digest("hex") }, { now: () => new Date(now()).toISOString() });
    const repository = new SqliteCourseTraining(db, importer);
    diagnostic.stage = "SOURCE_RESOLUTION";
    const source = repository.resolve(1, learner);
    diagnostic.stage = "PAYLOAD_GUARD";
    const payload = assertCoursePayload(buildCoursePayload(source, 2));
    let calls = 0;
    if (options.authorize) {
      diagnostic.stage = "PRE_PROVIDER";
      const transport = singleAttemptTransport(async (url, init) => { calls++; return diagnostic.transport(options.request)(url, init); });
      const generator = new OpenAiCourseGenerator({ load: () => ({ apiKey: options.key(), dailyBudgetCad: Number(options.budget) }) }, () => options.model, transport, { budgetCad: () => Number(options.budget), now });
      const service = new CourseTraining({ resolve: (...args) => repository.resolve(...args), list: source => repository.list(source), save: corpus => {
        diagnostic.stage = "PERSISTENCE";
        return repository.save(corpus);
      } }, { generate: async (source, count) => {
        const items = await generator.generate(source, count);
        diagnostic.stage = "CORPUS_VALIDATION";
        return items;
      } }, randomUUID);
      await service.execute(1, learner, { action: "generate", desiredQuestionCount: 2 });
      diagnostic.stage = "REVIEW_READ";
      const review = service.read(1, learner);
      if (review.questions.length !== 2 || review.questions.some(q => q.status !== "DRAFT")) throw new Error("TEST_DRAFTS_INVALID");
      options.review?.(review); // Memory only; CLI never logs content.
    }
    const records = repository.list(source);
    const published = records.filter(r => r.item.status === "PUBLISHED").length;
    if (published) throw new Error("TEST_PUBLICATION_FORBIDDEN");
    return { status: options.authorize ? "PASS" : "PREPARED_ONLY", database: ":memory:", pdfChecksumMatch: true, excerptPages: "1–8", ownership: true, sourceReady: true, ...payload, maximumCad: cost.maximumCad, calls, draftsPersisted: records.length, published, filesWritten: 0 };
  } finally { sqlite.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const diagnostic = new LocalCourseDiagnostics();
  try {
    const args = process.argv.slice(2);
    if (args.filter(a => a.startsWith("--pdf=")).length !== 1 || args.filter(a => a === "--authorize-openai-test").length > 1 || args.some(a => !a.startsWith("--pdf=") && a !== "--authorize-openai-test")) throw new Error("TEST_ARGUMENTS_INVALID");
    console.log(JSON.stringify(await runLocalCourseTraining({ diagnostics: diagnostic, pdf: args.find(a => a.startsWith("--pdf="))!.slice(6), model: process.env.OPENAI_MCQ_MODEL, budget: process.env.AI_DAILY_BUDGET_CAD, authorize: args.includes("--authorize-openai-test"), key: () => process.env.OPENAI_API_KEY, request: fetch })));
  } catch (error) {
    console.error(JSON.stringify({ event: "LOCAL_COURSE_TEST_FAILED", ...diagnostic.failure(error) }));
    process.exitCode = 1;
  }
}
