import "server-only";
import {
  normalizeExtractedText,
  type ExtractedDocumentContent,
} from "@/domain/documents/extracted-content";

const OCR_RENDER_SCALE = 2;
const DEFAULT_OPERATION_TIMEOUT_MS = 45_000;
const DEFAULT_CLEANUP_TIMEOUT_MS = 5_000;
// MED SNC.pdf (28 pages) takes about 112 s locally; five minutes leaves ~2.7x headroom
// while preventing the previous per-page guards from accumulating for tens of minutes.
export const DEFAULT_OCR_DEADLINE_MS = 5 * 60_000;
export const MAX_OCR_PAGE_PIXELS = 16_000_000;
export const MAX_LOCAL_OCR_PAGES = 50;

type RenderedPdf = Readonly<{
  pageCount: number;
  renderPage(pageNumber: number): Promise<Uint8Array>;
  destroy(): Promise<void>;
}>;

type OcrWorker = Readonly<{
  recognize(image: Uint8Array): Promise<string>;
  terminate(): Promise<void>;
}>;

export type LocalPdfOcrRuntime = Readonly<{
  openPdf(bytes: Uint8Array): Promise<RenderedPdf>;
  createWorker(): Promise<OcrWorker>;
}>;

type OcrEvent = Readonly<{
  name: string;
  status: "degraded";
  errorCode: string;
  context?: Readonly<Record<string, unknown>>;
}>;

export type PdfOcrLogger = Readonly<{
  event(event: OcrEvent): void;
}>;

export type LocalPdfOcrGate = Readonly<{
  tryAcquire(): (() => void) | null;
}>;

export type LocalPdfOcrLimits = Readonly<{
  operationTimeoutMs: number;
  cleanupTimeoutMs: number;
  deadlineMs: number;
}>;

export type LocalPdfOcrDependencies = Readonly<{
  runtime?: LocalPdfOcrRuntime;
  logger?: PdfOcrLogger;
  gate?: LocalPdfOcrGate;
  limits?: Partial<LocalPdfOcrLimits>;
  now?: () => number;
}>;

export interface PdfOcrPort {
  extract(bytes: Uint8Array, pageCountHint?: number): Promise<ExtractedDocumentContent>;
}

class OcrGuardError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "OcrGuardError";
  }
}

export function createLocalPdfOcrGate(): LocalPdfOcrGate {
  let active = false;
  return {
    tryAcquire() {
      if (active) return null;
      active = true;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active = false;
      };
    },
  };
}

const processLocalPdfOcrGate = createLocalPdfOcrGate();

export function assertOcrPagePixelLimit(width: number, height: number): void {
  if (
    !Number.isSafeInteger(width)
    || !Number.isSafeInteger(height)
    || width <= 0
    || height <= 0
    || width * height > MAX_OCR_PAGE_PIXELS
  ) {
    throw new OcrGuardError("OCR_PAGE_PIXEL_LIMIT");
  }
}

function timeout<T>(operation: Promise<T>, timeoutMs: number, error: OcrGuardError): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(error);
    }, timeoutMs);
    timer.unref();
    operation.then(
      (value) => {
        if (expired) return;
        clearTimeout(timer);
        resolve(value);
      },
      (cause: unknown) => {
        if (expired) return;
        clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

function createLocalPdfOcrRuntime(): LocalPdfOcrRuntime {
  return {
    async openPdf(bytes) {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const task = pdfjs.getDocument({
        data: bytes.slice(),
        stopAtErrors: true,
        useSystemFonts: false,
      });
      const pdf = await task.promise;
      return {
        pageCount: pdf.numPages,
        async renderPage(pageNumber) {
          const { createCanvas } = await import("@napi-rs/canvas");
          const page = await pdf.getPage(pageNumber);
          try {
            const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
            const width = Math.ceil(viewport.width);
            const height = Math.ceil(viewport.height);
            assertOcrPagePixelLimit(width, height);
            const canvas = createCanvas(width, height);
            await page.render({
              canvas: canvas as unknown as HTMLCanvasElement,
              canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D,
              viewport,
            }).promise;
            return new Uint8Array(canvas.toBuffer("image/png"));
          } finally {
            page.cleanup();
          }
        },
        async destroy() {
          await task.destroy();
        },
      };
    },
    async createWorker() {
      const [{ createWorker, OEM }, languageModule] = await Promise.all([
        import("tesseract.js"),
        import("@tesseract.js-data/fra"),
      ]);
      const language = languageModule.default;
      const worker = await createWorker(language.code, OEM.LSTM_ONLY, {
        cacheMethod: "none",
        gzip: language.gzip,
        langPath: language.langPath,
      });
      return {
        async recognize(image) {
          const result = await worker.recognize(Buffer.from(image));
          return result.data.text;
        },
        async terminate() {
          await worker.terminate();
        },
      };
    },
  };
}

export class LocalPdfOcr implements PdfOcrPort {
  private readonly runtime: LocalPdfOcrRuntime;
  private readonly logger?: PdfOcrLogger;
  private readonly gate: LocalPdfOcrGate;
  private readonly limits: LocalPdfOcrLimits;
  private readonly now: () => number;

  constructor(dependencies: LocalPdfOcrDependencies = {}) {
    this.runtime = dependencies.runtime ?? createLocalPdfOcrRuntime();
    this.logger = dependencies.logger;
    this.gate = dependencies.gate ?? processLocalPdfOcrGate;
    this.limits = {
      operationTimeoutMs: dependencies.limits?.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS,
      cleanupTimeoutMs: dependencies.limits?.cleanupTimeoutMs ?? DEFAULT_CLEANUP_TIMEOUT_MS,
      deadlineMs: dependencies.limits?.deadlineMs ?? DEFAULT_OCR_DEADLINE_MS,
    };
    this.now = dependencies.now ?? Date.now;
  }

  private log(errorCode: string, context?: Readonly<Record<string, unknown>>): void {
    this.logger?.event({
      name: "document.ocr.degraded",
      status: "degraded",
      errorCode,
      context,
    });
  }

  private async cleanupResource(operation: string, cleanup: () => Promise<void>): Promise<boolean> {
    try {
      await timeout(
        Promise.resolve().then(cleanup),
        this.limits.cleanupTimeoutMs,
        new OcrGuardError("OCR_CLEANUP_TIMEOUT"),
      );
      return true;
    } catch (error) {
      this.log(error instanceof OcrGuardError ? error.code : "OCR_CLEANUP_FAILED", { operation });
      return false;
    }
  }

  private runOperation<T>(start: () => Promise<T>, deadlineAt: number): Promise<T> {
    const remainingMs = deadlineAt - this.now();
    if (remainingMs <= 0) return Promise.reject(new OcrGuardError("OCR_GLOBAL_DEADLINE"));
    const limitedByDeadline = remainingMs <= this.limits.operationTimeoutMs;
    return timeout(
      Promise.resolve().then(start),
      Math.min(remainingMs, this.limits.operationTimeoutMs),
      new OcrGuardError(limitedByDeadline ? "OCR_GLOBAL_DEADLINE" : "OCR_OPERATION_TIMEOUT"),
    );
  }

  private async acquireResource<T>(
    start: () => Promise<T>,
    cleanup: (resource: T) => Promise<void>,
    cleanupOperation: string,
    deadlineAt: number,
    lateCleanups: Array<Promise<boolean>>,
  ): Promise<T> {
    const remainingMs = deadlineAt - this.now();
    if (remainingMs <= 0) throw new OcrGuardError("OCR_GLOBAL_DEADLINE");
    const operation = Promise.resolve().then(start);
    try {
      const limitedByDeadline = remainingMs <= this.limits.operationTimeoutMs;
      return await timeout(
        operation,
        Math.min(remainingMs, this.limits.operationTimeoutMs),
        new OcrGuardError(limitedByDeadline ? "OCR_GLOBAL_DEADLINE" : "OCR_OPERATION_TIMEOUT"),
      );
    } catch (error) {
      if (error instanceof OcrGuardError) {
        lateCleanups.push(operation.then(
          (resource) => this.cleanupResource(cleanupOperation, () => cleanup(resource)),
          () => true,
        ));
      }
      throw error;
    }
  }

  async extract(bytes: Uint8Array, pageCountHint?: number): Promise<ExtractedDocumentContent> {
    const release = this.gate.tryAcquire();
    if (!release) {
      this.log("OCR_SATURATED", { pageCount: pageCountHint });
      return { text: "", pages: [], pageCount: pageCountHint, status: "REQUIRES_OCR" };
    }

    const deadlineAt = this.now() + this.limits.deadlineMs;
    const lateCleanups: Array<Promise<boolean>> = [];
    let pdf: RenderedPdf | undefined;
    let worker: OcrWorker | undefined;
    let pageCount = pageCountHint;
    let cleanupSafe = true;
    try {
      pdf = await this.acquireResource(
        () => this.runtime.openPdf(bytes),
        (resource) => resource.destroy(),
        "pdf.destroy.late",
        deadlineAt,
        lateCleanups,
      );
      pageCount = pdf.pageCount;
      if (pageCount > MAX_LOCAL_OCR_PAGES) {
        this.log("OCR_PAGE_LIMIT", { pageCount });
        return { text: "", pages: [], pageCount, status: "REQUIRES_OCR" };
      }
      worker = await this.acquireResource(
        () => this.runtime.createWorker(),
        (resource) => resource.terminate(),
        "worker.terminate.late",
        deadlineAt,
        lateCleanups,
      );
      const pages: Array<{ pageNumber: number; text: string }> = [];
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const image = await this.runOperation(() => pdf!.renderPage(pageNumber), deadlineAt);
        const text = normalizeExtractedText(
          await this.runOperation(() => worker!.recognize(image), deadlineAt),
        );
        pages.push({ pageNumber, text });
      }
      const text = normalizeExtractedText(pages.map((page) => page.text).join("\n\n"));
      if (!text) this.log("OCR_NO_TEXT", { pageCount });
      return {
        text,
        pages,
        pageCount,
        status: text ? "COMPLETED" : "REQUIRES_OCR",
      };
    } catch (error) {
      this.log(error instanceof OcrGuardError ? error.code : "OCR_FAILED", { pageCount });
      return { text: "", pages: [], pageCount, status: "REQUIRES_OCR" };
    } finally {
      const cleanupResults = await Promise.all([
        worker ? this.cleanupResource("worker.terminate", () => worker!.terminate()) : true,
        pdf ? this.cleanupResource("pdf.destroy", () => pdf!.destroy()) : true,
      ]);
      cleanupSafe = cleanupResults.every(Boolean);
      if (lateCleanups.length === 0) {
        if (cleanupSafe) release();
      } else {
        void Promise.all(lateCleanups).then((results) => {
          if (cleanupSafe && results.every(Boolean)) release();
        });
      }
    }
  }
}
