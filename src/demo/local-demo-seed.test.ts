import { describe, expect, it } from "vitest";
import { LOCAL_DEMO_SEED_SQL } from "./local-demo-seed";

describe("local demo seed", () => {
  it("identifie explicitement les documents synthétiques", () => {
    const insertedDocuments = LOCAL_DEMO_SEED_SQL.match(/\[DÉMO\]/g) ?? [];
    expect(insertedDocuments.length).toBeGreaterThanOrEqual(4);
    expect(LOCAL_DEMO_SEED_SQL).toContain("Démonstration");
  });
});
