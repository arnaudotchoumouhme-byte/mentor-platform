import { expect, it, vi } from "vitest";
import { extract, EXCERPT_PAGES } from "../../../scripts/test-openai-course-isolated";

const pdf = vi.hoisted(() => ({
  numPages: 20,
  getPage: vi.fn(async (n: number) => ({
    getTextContent: async () => ({ items: [{ str: `PAGE_${n}_ONLY`, hasEOL: true }] }),
    cleanup: vi.fn(),
  })),
  destroy: vi.fn(async () => {}),
}));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: () => ({ promise: Promise.resolve(pdf), destroy: pdf.destroy }),
}));

it("extracts exactly pages 1 through 8 in memory and never reads page 9 onward", async () => {
  const result = await extract(new Uint8Array([1]));
  expect(EXCERPT_PAGES).toEqual({ first: 1, last: 8 });
  expect(pdf.getPage.mock.calls.map(([n]) => n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(result.pages).toBe(20);
  for (let n = 1; n <= 8; n++) expect(result.text).toContain(`PAGE_${n}_ONLY`);
  expect(result.text).not.toContain("PAGE_9_ONLY");
  expect(pdf.destroy).toHaveBeenCalledTimes(1);
});

it("refuses a PDF missing any authorized page instead of silently shortening the excerpt", async () => {
  pdf.numPages = 7;
  pdf.getPage.mockClear();
  await expect(extract(new Uint8Array([1]))).rejects.toThrow("TEST_EXCERPT_PAGES_MISSING");
  expect(pdf.getPage).not.toHaveBeenCalled();
});
