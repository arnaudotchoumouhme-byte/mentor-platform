import { describe, expect, it } from "vitest";
import { LocalFeatureEmbeddingProvider } from "./local-feature-embedding";

const cosine = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, index) => sum + value * b[index], 0);
describe("LocalFeatureEmbeddingProvider", () => {
  it("produces deterministic normalized vectors and ranks related text higher", () => {
    const provider = new LocalFeatureEmbeddingProvider();
    const query = provider.embedQuery("pharmacocinétique absorption élimination");
    expect(query).toHaveLength(384);
    expect(provider.embedQuery("pharmacocinétique absorption élimination")).toEqual(query);
    expect(cosine(query, provider.embedDocumentChunk("Pharmacocinétique : absorption, distribution et élimination.")))
      .toBeGreaterThan(cosine(query, provider.embedDocumentChunk("Communication administrative provinciale.")));
  });
});
