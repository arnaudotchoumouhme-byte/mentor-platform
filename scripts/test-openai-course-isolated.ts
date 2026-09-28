import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isolatedCostGuard, inspectIsolatedRequest } from "./isolated-openai-cost-guard";
import { isolatedCostPreflight } from "./isolated-openai-cost-policy";
import { OpenAiCourseGenerator } from "../src/infrastructure/mcq/openai-course-generator";
import { parseMcqCorpus } from "../src/application/mcq/mcq-corpus-contract";
import type { CourseQuestionGenerator } from "../src/application/mcq/course-training-contract";

export const TEST_MODEL = "gpt-5.6-terra";
export const PDF_SHA256 = "f6e0e6a5c46a9504719974cf979c18924b612f79bc96697d069e88774aa34bd7";
export const PDF_NAME = "PROCESSUS-DE-SOINS-PHARMACEUTIQUES_Cours-Maitre-PEBC.pdf";
type Dependencies = {
  read: (path: string) => Promise<Uint8Array>;
  extract: (bytes: Uint8Array) => Promise<{ text: string; pages: number }>;
  generator: () => CourseQuestionGenerator;
};

/** No DB, importer, filesystem output, publication or application bootstrap. */
export async function runIsolatedCourseTest(args: string[], env: Record<string, string | undefined>, deps: Dependencies) {
  if (args.some(a => !a.startsWith("--pdf=") && a !== "--authorize-openai-test") || args.filter(a => a.startsWith("--pdf=")).length !== 1 || args.filter(a => a === "--authorize-openai-test").length > 1) throw new Error("TEST_ARGUMENTS_INVALID");
  const pdfPath = args.find(a => a.startsWith("--pdf="))!.slice(6);
  const authorized = args.includes("--authorize-openai-test");
  if (!pdfPath) throw new Error("TEST_PDF_REQUIRED");
  if (basename(pdfPath) !== PDF_NAME) throw new Error("TEST_PDF_NAME_MISMATCH");
  if (authorized && (!env.OPENAI_API_KEY || env.OPENAI_MCQ_MODEL !== TEST_MODEL || !(Number(env.AI_DAILY_BUDGET_CAD) > 0))) throw new Error("TEST_SERVER_CONFIGURATION_MISSING");
  const bytes = await deps.read(pdfPath);
  if (createHash("sha256").update(bytes).digest("hex") !== PDF_SHA256) throw new Error("TEST_PDF_CHECKSUM_MISMATCH");
  const { text, pages } = await deps.extract(bytes);
  if (!text.trim() || text.length > 180_000 || pages < 1) throw new Error("TEST_EXTRACTION_INVALID");
  const base = { model: TEST_MODEL, pdfChecksumMatch: true, pages, databaseOpened: false, filesWritten: 0, published: 0 };
  const input = await measureFullSourcePayload(text);
  if (!input.inputFits) return { ...base, ...input, realCallExecuted: false, status: "BLOCKED_INPUT_LIMIT" };
  if (!authorized) return { ...base, ...input, realCallExecuted: false, status: "PREPARED_ONLY" };
  // Ephemeral provenance identity, never a production source UUID or an import artifact.
  const sourceVersionId = randomUUID();
  const generated = await deps.generator().generate({ documentId: 0, name: PDF_NAME, text, sourceVersionId }, 2);
  if (generated.length !== 2 || generated.some(i => i.status !== "DRAFT" || i.version !== 1 || i.source.sourceVersionId !== sourceVersionId || i.choices.filter(c => c.id === i.correctChoiceId).length !== 1 || new Set(i.choices.map(c => c.id)).size !== 4 || !i.mappings.length)) throw new Error("TEST_CANDIDATES_INVALID");
  const corpus = parseMcqCorpus({ schemaVersion: "MCQ_CORPUS/1", corpusId: `ISOLATED-NOT-FOR-IMPORT:${randomUUID()}`, corpusVersion: 1, blueprintVersionId: "PEBC-PART-I-2026", items: generated.map((i, n) => ({ ...i, itemId: `ISOLATED-${n + 1}` })) });
  return { ...base, realCallExecuted: true, status: "PASS", draftCandidates: corpus.items.length, schema: "PASS", provenance: "EXACT_PDF_AND_VERIFIED_QUOTES_EPHEMERAL_ID", clinicalReview: "NOT_PERFORMED" };
}

/** Reuse the real payload builder with an in-memory transport, never fetch/key access. */
export async function measureFullSourcePayload(text: string) {
  let input: ReturnType<typeof inspectIsolatedRequest>["input"] | undefined;
  const generator = new OpenAiCourseGenerator({ load: () => ({ apiKey: "offline-placeholder", dailyBudgetCad: 1 }) }, () => TEST_MODEL,
    async (url, init) => {
      input = inspectIsolatedRequest(url, init).input;
      return new Response(null, { status: 400 }); // Intentional offline stop, no network.
    });
  try { await generator.generate({ documentId: 0, name: PDF_NAME, text, sourceVersionId: "offline-only" }, 2); }
  catch { if (!input) throw new Error("TEST_PAYLOAD_UNMEASURABLE"); }
  if (!input) throw new Error("TEST_PAYLOAD_UNMEASURABLE");
  return input;
}

export async function extract(bytes: Uint8Array) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(bytes), stopAtErrors: true, useSystemFonts: false, verbosity: 0 });
  try {
    const pdf = await task.promise;
    const texts: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      texts.push(content.items.map(i => "str" in i ? `${i.str}${i.hasEOL ? "\n" : " "}` : "").join(""));
      page.cleanup();
    }
    return { text: texts.join("\n\n").replace(/[ \t]+/g, " ").trim(), pages: pdf.numPages };
  } finally { await task.destroy(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let stage = "MODULE_LOAD";
  try {
    // Refuse over-budget requests before key access/provider construction.
    if (process.argv.includes("--authorize-openai-test")) {
      stage = "COST_PREFLIGHT";
      const cost = isolatedCostPreflight(process.env);
      console.log(JSON.stringify({ costPreflight: cost }));
      if (!cost.allowed) throw new Error("TEST_BUDGET_EXCEEDED");
    }
    stage = "PREFLIGHT";
    const result = await runIsolatedCourseTest(process.argv.slice(2), process.env, {
      read: path => { stage = "PDF_READ"; return readFile(path); },
      extract: async bytes => { stage = "PDF_EXTRACTION"; const result = await extract(bytes); stage = "VALIDATION"; return result; },
      generator: () => new OpenAiCourseGenerator({ load: () => ({ apiKey: process.env.OPENAI_API_KEY, dailyBudgetCad: Number(process.env.AI_DAILY_BUDGET_CAD) }) }, () => process.env.OPENAI_MCQ_MODEL, isolatedCostGuard(process.env)),
    });
    console.log(JSON.stringify(result));
    if (result.status === "BLOCKED_INPUT_LIMIT") process.exitCode = 1;
  } catch {
    // Do not print exceptions, provider responses, document content, environment or credentials.
    console.error(`ISOLATED_OPENAI_TEST_FAILED (${stage}) — verify arguments, PDF checksum and server configuration; no automatic retry.`);
    process.exitCode = 1;
  }
}
