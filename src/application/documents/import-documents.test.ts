import { describe, expect, it, vi } from "vitest";
import { ImportDocuments } from "./import-documents";

const bytes = new TextEncoder().encode("Cours");
const extractor = { extract: vi.fn(async () => ({ text: "Cours", pages: [], status: "COMPLETED" as const })) };
const checksum = { sha256: vi.fn(() => "checksum") };

function file(name = "cours.txt") {
  return { name, browserMediaType: "text/plain", size: bytes.length, bytes };
}

describe("ImportDocuments", () => {
  it("assigns distinct internal identifiers to colliding user names", async () => {
    const ids = { generate: vi.fn()
      .mockReturnValueOnce("source-1").mockReturnValueOnce("version-1")
      .mockReturnValueOnce("source-2").mockReturnValueOnce("version-2") };
    const persistence = { recover: vi.fn(), hasChecksum: vi.fn(async () => false), persist: vi.fn() };
    const useCase = new ImportDocuments(ids, persistence, extractor, checksum);

    await expect(useCase.execute({ subject: "Pharmacologie", files: [file(), file()] })).resolves.toEqual({
      imported: ["cours.txt", "cours.txt"], rejected: [],
      documents: [
        { name: "cours.txt", status: "READY", sourceId: "source-1", sourceVersionId: "version-1" },
        { name: "cours.txt", status: "READY", sourceId: "source-2", sourceVersionId: "version-2" },
      ],
    });
    expect(persistence.persist).toHaveBeenNthCalledWith(1, expect.objectContaining({ storageId: "source-1", extension: "txt", bytes }));
    expect(persistence.persist).toHaveBeenNthCalledWith(2, expect.objectContaining({ storageId: "source-2", extension: "txt", bytes }));
    expect(persistence.recover).toHaveBeenCalledOnce();
  });

  it("rejects a duplicate checksum without overwriting the existing source", async () => {
    const persistence = { recover: vi.fn(), hasChecksum: vi.fn(async () => true), persist: vi.fn() };
    const useCase = new ImportDocuments({ generate: vi.fn() }, persistence, extractor, checksum);
    await expect(useCase.execute({ subject: "Pharmacologie", files: [file()] })).rejects.toMatchObject({ code: "FILE_DUPLICATE" });
    expect(persistence.persist).not.toHaveBeenCalled();
  });

  it("propagates a controlled persistence failure", async () => {
    const useCase = new ImportDocuments(
      { generate: () => "internal-id" },
      { recover: vi.fn(), hasChecksum: vi.fn(async () => false), persist: vi.fn().mockRejectedValue(new Error("database unavailable")) },
      extractor,
      checksum,
    );
    await expect(useCase.execute({ subject: "Pharmacologie", files: [file()] })).rejects.toThrow("database unavailable");
  });

  it("does not allocate storage for rejected files", async () => {
    const persistence = { recover: vi.fn(), hasChecksum: vi.fn(async () => false), persist: vi.fn() };
    const useCase = new ImportDocuments({ generate: vi.fn() }, persistence, extractor, checksum);
    await expect(useCase.execute({ subject: "Mixte", files: [file("virus.exe")] })).resolves.toEqual({
      imported: [], rejected: ["Fichier 1"], documents: [],
    });
    expect(persistence.persist).not.toHaveBeenCalled();
  });
});
