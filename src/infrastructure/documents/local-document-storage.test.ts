import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalDocumentStorage } from "./local-document-storage";

const id = "123e4567-e89b-42d3-a456-426614174000";
let directory: string;
const storage = () => new LocalDocumentStorage(path.join(directory, "data"));

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "mentor-upload-test-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("LocalDocumentStorage", () => {
  it("writes to an internal UUID path and closes the handle", async () => {
    const files = storage();
    await files.writeTemporary({ id, extension: "txt", bytes: new TextEncoder().encode("safe") });
    const target = path.join(directory, "data", "documents", ".pending", `${id}.txt`);
    await expect(readFile(target, "utf8")).resolves.toBe("safe");
    await expect(rm(target)).resolves.toBeUndefined();
  });

  it("refuses collisions without overwriting existing content", async () => {
    const target = path.join(directory, "data", "documents", ".pending", `${id}.txt`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "original");
    const files = storage();
    await expect(
      files.writeTemporary({ id, extension: "txt", bytes: new TextEncoder().encode("replacement") }),
    ).rejects.toMatchObject({ code: "EEXIST" });
    await expect(readFile(target, "utf8")).resolves.toBe("original");
  });

  it("rejects traversal attempts in internal keys", async () => {
    const files = storage();
    await expect(
      files.writeTemporary({ id: "../escape", extension: "txt", bytes: new Uint8Array([1]) }),
    ).rejects.toThrow("Invalid internal document storage key");
  });

  it("promotes a temporary file without overwriting a final file", async () => {
    const files = storage();
    await files.writeTemporary({ id, extension: "txt", bytes: new TextEncoder().encode("safe") });
    await files.promote({ id, extension: "txt" });
    await expect(files.exists("pending", { id, extension: "txt" })).resolves.toBe(false);
    await expect(files.exists("final", { id, extension: "txt" })).resolves.toBe(true);
    await files.writeTemporary({ id, extension: "txt", bytes: new TextEncoder().encode("other") });
    await expect(files.promote({ id, extension: "txt" })).rejects.toMatchObject({ code: "EEXIST" });
    await expect(
      readFile(path.join(directory, "data", "documents", `${id}.txt`), "utf8"),
    ).resolves.toBe("safe");
  });
});
