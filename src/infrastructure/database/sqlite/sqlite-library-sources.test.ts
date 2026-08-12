import { describe, expect, it, vi } from "vitest";
import { SqliteLibrarySources } from "./sqlite-library-sources";

describe("SqliteLibrarySources", () => {
  it("uses bound identifiers and explicitly classifies unmodelled legacy data", () => {
    const database = { all: vi.fn(() => []), run: vi.fn() };
    const repository = new SqliteLibrarySources(database);
    expect(repository.getByDocumentId(7)).toBeNull();
    expect(database.all).toHaveBeenCalledWith(expect.stringContaining("LEGACY_UNCLASSIFIED"), 7);
  });
});
