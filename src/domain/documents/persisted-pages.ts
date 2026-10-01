import type { ExtractedPage } from "./extracted-content";
import { AppError } from "@/shared/errors/app-error";

/** Validate without rewriting extraction text; missing legacy pages stay missing. */
export function validatePersistedPages(value: unknown): readonly ExtractedPage[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some((p, i) => !p || !Number.isSafeInteger(p.pageNumber) || p.pageNumber !== i + 1 || typeof p.text !== "string")) {
    throw new AppError({ code: "DOCUMENT_PAGES_INVALID", category: "validation", userMessage: "Les pages extraites du document sont invalides." });
  }
  return value;
}
