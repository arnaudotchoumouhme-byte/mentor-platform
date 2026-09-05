import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertOcrPagePixelLimit,
  createLocalPdfOcrGate,
  LocalPdfOcr,
  MAX_LOCAL_OCR_PAGES,
  MAX_OCR_PAGE_PIXELS,
  type LocalPdfOcrRuntime,
  type PdfOcrLogger,
} from "./local-pdf-ocr";

const localOcrFixture = process.env.MENTOR_LOCAL_OCR_FIXTURE;
const localOcrIntegrationTest = localOcrFixture ? it : it.skip;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}

function runtimeFor(texts: readonly string[]) {
  const events: string[] = [];
  const runtime: LocalPdfOcrRuntime = {
    async openPdf() {
      return {
        pageCount: texts.length,
        async renderPage(pageNumber) {
          events.push(`render:${pageNumber}`);
          return new Uint8Array([pageNumber]);
        },
        async destroy() {
          events.push("pdf:destroy");
        },
      };
    },
    async createWorker() {
      events.push("worker:create");
      return {
        async recognize(image) {
          const pageNumber = image[0] ?? 0;
          events.push(`recognize:${pageNumber}`);
          return texts[pageNumber - 1] ?? "";
        },
        async terminate() {
          events.push("worker:terminate");
        },
      };
    },
  };
  return { events, runtime };
}

function createOcr(
  runtime: LocalPdfOcrRuntime,
  options: Readonly<{
    logger?: PdfOcrLogger;
    operationTimeoutMs?: number;
    cleanupTimeoutMs?: number;
    deadlineMs?: number;
  }> = {},
) {
  return new LocalPdfOcr({
    runtime,
    logger: options.logger,
    gate: createLocalPdfOcrGate(),
    limits: {
      operationTimeoutMs: options.operationTimeoutMs ?? 100,
      cleanupTimeoutMs: options.cleanupTimeoutMs ?? 20,
      deadlineMs: options.deadlineMs ?? 1_000,
    },
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("LocalPdfOcr", () => {
  localOcrIntegrationTest("extracts a local image-only PDF without persistence", async () => {
    const bytes = new Uint8Array(await readFile(localOcrFixture!));
    const result = await new LocalPdfOcr().extract(bytes);
    expect(result.status).toBe("COMPLETED");
    expect(result.pageCount).toBeGreaterThan(0);
    expect(result.pages).toHaveLength(result.pageCount!);
    expect(result.text.length).toBeGreaterThan(0);
  }, 10 * 60_000);

  it("recognizes pages sequentially and normalizes their text", async () => {
    const { events, runtime } = runtimeFor([" Première page  ", "Deuxième\n\n\npage"]);
    await expect(createOcr(runtime).extract(new Uint8Array([1]))).resolves.toEqual({
      text: "Première page\n\nDeuxième\n\npage",
      pages: [
        { pageNumber: 1, text: "Première page" },
        { pageNumber: 2, text: "Deuxième\n\npage" },
      ],
      pageCount: 2,
      status: "COMPLETED",
    });
    expect(events).toEqual([
      "worker:create",
      "render:1",
      "recognize:1",
      "render:2",
      "recognize:2",
      "worker:terminate",
      "pdf:destroy",
    ]);
  });

  it("keeps the safe OCR-required state when recognition produces no text", async () => {
    const { runtime } = runtimeFor(["", "  "]);
    await expect(createOcr(runtime).extract(new Uint8Array([1]))).resolves.toMatchObject({
      text: "",
      pageCount: 2,
      status: "REQUIRES_OCR",
    });
  });

  it("fails closed, cleans up, and logs no OCR error detail when recognition fails", async () => {
    const { events, runtime } = runtimeFor(["text"]);
    const logger = { event: vi.fn() };
    const failingRuntime: LocalPdfOcrRuntime = {
      ...runtime,
      async createWorker() {
        const worker = await runtime.createWorker();
        return {
          ...worker,
          recognize: vi.fn(async () => { throw new Error("sensitive synthetic OCR failure"); }),
        };
      },
    };
    await expect(createOcr(failingRuntime, { logger }).extract(new Uint8Array([1]))).resolves.toMatchObject({
      text: "",
      pageCount: 1,
      status: "REQUIRES_OCR",
    });
    expect(events).toContain("worker:terminate");
    expect(events).toContain("pdf:destroy");
    expect(logger.event).toHaveBeenCalledWith(expect.objectContaining({ errorCode: "OCR_FAILED" }));
    expect(JSON.stringify(logger.event.mock.calls)).not.toContain("sensitive synthetic OCR failure");
  });

  it("cleans up a PDF acquired after openPdf times out", async () => {
    vi.useFakeTimers();
    const latePdf = deferred<Awaited<ReturnType<LocalPdfOcrRuntime["openPdf"]>>>();
    const destroy = vi.fn(async () => undefined);
    const runtime: LocalPdfOcrRuntime = {
      openPdf: vi.fn(() => latePdf.promise),
      createWorker: vi.fn(),
    };
    const resultPromise = createOcr(runtime, { operationTimeoutMs: 10 }).extract(new Uint8Array([1]));
    await vi.advanceTimersByTimeAsync(11);
    await expect(resultPromise).resolves.toMatchObject({ status: "REQUIRES_OCR" });
    latePdf.resolve({ pageCount: 1, renderPage: vi.fn(), destroy });
    await vi.runAllTimersAsync();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("cleans up a worker acquired after createWorker times out", async () => {
    vi.useFakeTimers();
    const lateWorker = deferred<Awaited<ReturnType<LocalPdfOcrRuntime["createWorker"]>>>();
    const terminate = vi.fn(async () => undefined);
    const destroy = vi.fn(async () => undefined);
    const runtime: LocalPdfOcrRuntime = {
      async openPdf() {
        return { pageCount: 1, renderPage: vi.fn(), destroy };
      },
      createWorker: vi.fn(() => lateWorker.promise),
    };
    const resultPromise = createOcr(runtime, { operationTimeoutMs: 10 }).extract(new Uint8Array([1]));
    await vi.advanceTimersByTimeAsync(11);
    await expect(resultPromise).resolves.toMatchObject({ status: "REQUIRES_OCR" });
    expect(destroy).toHaveBeenCalledOnce();
    lateWorker.resolve({ recognize: vi.fn(), terminate });
    await vi.runAllTimersAsync();
    expect(terminate).toHaveBeenCalledOnce();
  });

  it("attempts PDF cleanup even when worker termination blocks", async () => {
    vi.useFakeTimers();
    const terminate = vi.fn(() => new Promise<void>(() => undefined));
    const destroy = vi.fn(async () => undefined);
    const runtime: LocalPdfOcrRuntime = {
      async openPdf() {
        return { pageCount: 1, renderPage: vi.fn(async () => new Uint8Array([1])), destroy };
      },
      async createWorker() {
        return {
          recognize: vi.fn(async () => { throw new Error("recognition failed"); }),
          terminate,
        };
      },
    };
    const resultPromise = createOcr(runtime, { cleanupTimeoutMs: 5 }).extract(new Uint8Array([1]));
    await vi.advanceTimersByTimeAsync(6);
    await expect(resultPromise).resolves.toMatchObject({ status: "REQUIRES_OCR" });
    expect(terminate).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("enforces one global deadline across page operations", async () => {
    vi.useFakeTimers();
    const logger = { event: vi.fn() };
    const runtime: LocalPdfOcrRuntime = {
      async openPdf() {
        return {
          pageCount: 1,
          renderPage: vi.fn(() => new Promise<Uint8Array>(() => undefined)),
          destroy: vi.fn(async () => undefined),
        };
      },
      async createWorker() {
        return { recognize: vi.fn(), terminate: vi.fn(async () => undefined) };
      },
    };
    const resultPromise = createOcr(runtime, {
      logger,
      operationTimeoutMs: 1_000,
      deadlineMs: 20,
    }).extract(new Uint8Array([1]));
    await vi.advanceTimersByTimeAsync(21);
    await expect(resultPromise).resolves.toMatchObject({ status: "REQUIRES_OCR" });
    expect(logger.event).toHaveBeenCalledWith(expect.objectContaining({ errorCode: "OCR_GLOBAL_DEADLINE" }));
  });

  it("rejects a second concurrent OCR without queueing it", async () => {
    const recognition = deferred<string>();
    const recognize = vi.fn(() => recognition.promise);
    const logger = { event: vi.fn() };
    const { runtime } = runtimeFor(["first"]);
    const heldRuntime: LocalPdfOcrRuntime = {
      ...runtime,
      async createWorker() {
        return { recognize, terminate: vi.fn(async () => undefined) };
      },
    };
    const gate = createLocalPdfOcrGate();
    const ocr = new LocalPdfOcr({ runtime: heldRuntime, logger, gate });
    const first = ocr.extract(new Uint8Array([1]));
    await vi.waitFor(() => expect(recognize).toHaveBeenCalledOnce());
    await expect(ocr.extract(new Uint8Array([2]), 7)).resolves.toEqual({
      text: "",
      pages: [],
      pageCount: 7,
      status: "REQUIRES_OCR",
    });
    expect(logger.event).toHaveBeenCalledWith(expect.objectContaining({ errorCode: "OCR_SATURATED" }));
    recognition.resolve("first");
    await expect(first).resolves.toMatchObject({ status: "COMPLETED" });
  });

  it("rejects page dimensions above 16 megapixels before rendering allocation", () => {
    expect(() => assertOcrPagePixelLimit(4_000, 4_000)).not.toThrow();
    expect(() => assertOcrPagePixelLimit(4_001, 4_000)).toThrowError("OCR_PAGE_PIXEL_LIMIT");
    expect(MAX_OCR_PAGE_PIXELS).toBe(16_000_000);
  });

  it("does not start OCR for documents above the local resource ceiling", async () => {
    const createWorker = vi.fn();
    const runtime: LocalPdfOcrRuntime = {
      async openPdf() {
        return {
          pageCount: MAX_LOCAL_OCR_PAGES + 1,
          renderPage: vi.fn(),
          destroy: vi.fn(async () => undefined),
        };
      },
      createWorker,
    };
    await expect(createOcr(runtime).extract(new Uint8Array([1]))).resolves.toMatchObject({
      pageCount: MAX_LOCAL_OCR_PAGES + 1,
      status: "REQUIRES_OCR",
    });
    expect(createWorker).not.toHaveBeenCalled();
  });
});
