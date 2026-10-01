import type { CourseRecord, CourseSource, PriorCourseQuestion } from "./course-training-contract";

export type PageRange = Readonly<{ pageStart: number; pageEnd: number }>;
export type CourseCoverage = Readonly<{
  pageCount: number;
  ranges: readonly PageRange[];
  lastPageCovered: number;
  pagesRemaining: number;
  publishedQuestions: number;
  rejectedQuestions: number;
  completed: boolean;
  trackingBlocked: boolean;
}>;

const PAGE_RANGE = /^pages ([1-9]\d*)–([1-9]\d*)$/u;

export function parseCoursePageRange(record: CourseRecord): PageRange | null {
  if (record.item.source.reference.type !== "PAGE") return null;
  const match = PAGE_RANGE.exec(record.item.source.reference.locator);
  if (!match) return null;
  const pageStart = Number(match[1]);
  const pageEnd = Number(match[2]);
  return Number.isSafeInteger(pageStart) && Number.isSafeInteger(pageEnd) && pageStart <= pageEnd
    ? { pageStart, pageEnd }
    : null;
}

export function courseCoverage(source: CourseSource, records: readonly CourseRecord[]): CourseCoverage {
  const pageCount = source.pages?.length ?? 0;
  const parsed = records.map(parseCoursePageRange);
  const unique = new Map<string, PageRange>();
  for (const range of parsed) if (range) unique.set(`${range.pageStart}:${range.pageEnd}`, range);
  const ranges = [...unique.values()].sort((a, b) => a.pageStart - b.pageStart || a.pageEnd - b.pageEnd);
  let expectedStart = 1;
  let trackingBlocked = parsed.some(range => range === null);
  for (const range of ranges) {
    if (range.pageStart !== expectedStart || range.pageEnd > pageCount) trackingBlocked = true;
    expectedStart = range.pageEnd + 1;
  }
  const lastPageCovered = trackingBlocked ? 0 : (ranges.at(-1)?.pageEnd ?? 0);
  return {
    pageCount,
    ranges,
    lastPageCovered,
    pagesRemaining: Math.max(0, pageCount - lastPageCovered),
    publishedQuestions: records.filter(record => record.item.status === "PUBLISHED").length,
    rejectedQuestions: records.filter(record => record.item.status === "RETIRED").length,
    completed: pageCount > 0 && !trackingBlocked && lastPageCovered === pageCount,
    trackingBlocked,
  };
}

export function compactPreviousQuestions(records: readonly CourseRecord[]): readonly PriorCourseQuestion[] {
  return Object.freeze(records.flatMap(record => {
    const range = parseCoursePageRange(record);
    if (!range || (record.item.status !== "PUBLISHED" && record.item.status !== "RETIRED")) return [];
    return [Object.freeze({
      itemId: record.item.itemId,
      stem: record.item.stem.trim().slice(0, 200),
      pageStart: range.pageStart,
      pageEnd: range.pageEnd,
      status: record.item.status,
    })];
  }));
}
