import { describe, expect, it, vi } from "vitest";
import { ImportDocuments } from "./import-documents";

const bytes = new TextEncoder().encode("Cours");

function file(name = "cours.txt") {
  return { name, browserMediaType: "text/plain", size: bytes.length, bytes };
}

describe("ImportDocuments", () => {
  it("assigns distinct internal identifiers to colliding user names", async () => {
    const ids = { generate: vi.fn().mockReturnValueOnce("id-1").mockReturnValueOnce("id-2") };
    const persistence = { recover: vi.fn(), persist: vi.fn() };
    const useCase = new ImportDocuments(ids, persistence);

    await expect(
      useCase.execute({ subject: "Pharmacologie", files: [file(), file()] }),
    ).resolves.toEqual({ imported: ["cours.txt", "cours.txt"], rejected: [] });
    expect(persistence.persist).toHaveBeenNthCalledWith(1, expect.objectContaining({
      storageId: "id-1",
      extension: "txt",
      bytes,
    }));
    expect(persistence.persist).toHaveBeenNthCalledWith(2, expect.objectContaining({
      storageId: "id-2",
      extension: "txt",
      bytes,
    }));
    expect(persistence.recover).toHaveBeenCalledOnce();
  });

  it("propagates a controlled persistence failure", async () => {
    const useCase = new ImportDocuments(
      { generate: () => "internal-id" },
      {
        recover: vi.fn(),
        persist: vi.fn().mockRejectedValue(new Error("database unavailable")),
      },
    );

    await expect(
      useCase.execute({ subject: "Pharmacologie", files: [file()] }),
    ).rejects.toThrow("database unavailable");
  });

  it("does not allocate storage for rejected files", async () => {
    const persistence = { recover: vi.fn(), persist: vi.fn() };
    const useCase = new ImportDocuments(
      { generate: vi.fn() },
      persistence,
    );
    await expect(
      useCase.execute({ subject: "Mixte", files: [file("virus.exe")] }),
    ).resolves.toEqual({ imported: [], rejected: ["Fichier 1"] });
    expect(persistence.persist).not.toHaveBeenCalled();
  });
});
