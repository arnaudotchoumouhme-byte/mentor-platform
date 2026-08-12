import type { ChunkingInput, DocumentChunk } from "@/domain/rag/chunk";
import type { ChunkingService } from "./rag-ports";

export type ChunkingConfig = Readonly<{ targetCharacters: number; maximumCharacters: number; overlapCharacters: number }>;
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = { targetCharacters: 900, maximumCharacters: 1_300, overlapCharacters: 140 };
export interface ChunkIdentityPort { id(): string; hash(text: string): string; }

function paragraphs(text: string): string[] {
  return text.split(/\n{2,}/).flatMap((block) => block.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/g) ?? []).map((value) => value.trim()).filter(Boolean);
}

function headingBefore(text: string, position: number): string | null {
  const prefix = text.slice(0, position);
  const headings = [...prefix.matchAll(/^#{1,6}\s+(.+)$/gm)];
  return headings.at(-1)?.[1]?.trim() ?? null;
}

export class ParagraphChunker implements ChunkingService {
  constructor(private readonly identity: ChunkIdentityPort, private readonly config = DEFAULT_CHUNKING_CONFIG) {}

  chunk(input: ChunkingInput): readonly DocumentChunk[] {
    const units = paragraphs(input.text);
    const results: DocumentChunk[] = [];
    let cursor = 0;
    let buffer = "";
    let start = 0;
    const emit = (retainOverlap: boolean) => {
      const text = buffer.trim();
      if (!text) return;
      const charStart = input.text.indexOf(text, Math.max(0, start - this.config.overlapCharacters));
      const safeStart = charStart < 0 ? start : charStart;
      const sectionTitle = headingBefore(input.text, safeStart);
      results.push({
        chunkId: this.identity.id(), sourceId: input.sourceId, sourceVersionId: input.sourceVersionId,
        sequence: results.length, text, charStart: safeStart, charEnd: safeStart + text.length,
        pageStart: input.pages?.length === 1 ? input.pages[0].pageNumber : null,
        pageEnd: input.pages?.length === 1 ? input.pages[0].pageNumber : null,
        sectionTitle, headingPath: sectionTitle ? [sectionTitle] : [], approximateTokenCount: Math.ceil(text.length / 4),
        contentHash: this.identity.hash(text), indexStatus: "INDEXED",
        language: input.language ?? null, provenance: input.provenance,
      });
      const overlap = retainOverlap ? text.slice(-this.config.overlapCharacters) : "";
      start = safeStart + text.length - overlap.length;
      buffer = overlap;
    };
    for (const unit of units) {
      if (!buffer) start = input.text.indexOf(unit, cursor);
      if (buffer && buffer.length + unit.length + 1 > this.config.targetCharacters) emit(true);
      if (unit.length > this.config.maximumCharacters) {
        for (let offset = 0; offset < unit.length; offset += this.config.maximumCharacters - this.config.overlapCharacters) {
          buffer = unit.slice(offset, offset + this.config.maximumCharacters);
          emit(offset + this.config.maximumCharacters < unit.length);
        }
      } else buffer = `${buffer}${buffer ? " " : ""}${unit}`;
      cursor = Math.max(cursor, start + unit.length);
    }
    emit(false);
    return results;
  }
}
