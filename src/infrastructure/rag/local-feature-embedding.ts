import "server-only";
import type { EmbeddingProvider } from "@/application/rag/rag-ports";

const DIMENSIONS = 384;
function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}
function features(text: string): string[] {
  const normalized = text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const tokens = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  return tokens.flatMap((token) => {
    const stem = token.replace(/(iques?|ismes?|ation|ement|es|s)$/u, "");
    const padded = `^${stem}$`;
    const grams = Array.from({ length: Math.max(0, padded.length - 2) }, (_, index) => padded.slice(index, index + 3));
    return [stem, ...grams];
  });
}
function embed(text: string): readonly number[] {
  const vector = Array<number>(DIMENSIONS).fill(0);
  for (const feature of features(text)) {
    const value = hash(feature);
    vector[value % DIMENSIONS] += (value & 1) === 0 ? 1 : -1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => value / norm);
}

export class LocalFeatureEmbeddingProvider implements EmbeddingProvider {
  readonly id = "local-feature-hashing-v1";
  embedDocumentChunk(text: string): readonly number[] { return embed(text); }
  embedQuery(text: string): readonly number[] { return embed(text); }
}
