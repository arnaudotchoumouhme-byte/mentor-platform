import { access, link, mkdir, open, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const internalIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const extensionPattern = /^(pdf|docx|txt|md|png|jpg)$/;

export type DocumentStorageArtifact = Readonly<{
  id: string;
  extension: string;
  modifiedAt: number;
}>;

export interface DocumentImportStorage {
  writeTemporary(input: Readonly<{ id: string; extension: string; bytes: Uint8Array }>): Promise<void>;
  promote(input: Readonly<{ id: string; extension: string }>): Promise<void>;
  remove(kind: "pending" | "final", input: Readonly<{ id: string; extension: string }>): Promise<void>;
  exists(kind: "pending" | "final", input: Readonly<{ id: string; extension: string }>): Promise<boolean>;
  list(kind: "pending" | "final"): Promise<readonly DocumentStorageArtifact[]>;
}

export class LocalDocumentStorage implements DocumentImportStorage {
  private directory(kind: "pending" | "final"): string {
    return kind === "pending"
      ? path.join(process.cwd(), "storage", "documents", ".pending")
      : path.join(process.cwd(), "storage", "documents");
  }

  private resolve(kind: "pending" | "final", id: string, extension: string): string {
    if (!internalIdPattern.test(id) || !extensionPattern.test(extension)) {
      throw new Error("Invalid internal document storage key.");
    }
    // The directory is already constrained to storage/documents; prevent Turbopack
    // from treating the generated internal UUID filename as an arbitrary project path.
    return path.join(/* turbopackIgnore: true */ this.directory(kind), `${id}.${extension}`);
  }

  async writeTemporary(input: Readonly<{ id: string; extension: string; bytes: Uint8Array }>): Promise<void> {
    await mkdir(this.directory("pending"), { recursive: true });
    const target = this.resolve("pending", input.id, input.extension);
    const handle = await open(target, "wx", 0o600);
    let completed = false;
    try {
      await handle.writeFile(input.bytes);
      await handle.sync();
      completed = true;
    } finally {
      try {
        await handle.close();
      } finally {
        if (!completed) await rm(target, { force: true });
      }
    }
  }

  async promote(input: Readonly<{ id: string; extension: string }>): Promise<void> {
    await mkdir(this.directory("final"), { recursive: true });
    const pending = this.resolve("pending", input.id, input.extension);
    const final = this.resolve("final", input.id, input.extension);
    await link(pending, final);
    await rm(pending);
  }

  async remove(kind: "pending" | "final", input: Readonly<{ id: string; extension: string }>): Promise<void> {
    await rm(this.resolve(kind, input.id, input.extension), { force: true });
  }

  async exists(kind: "pending" | "final", input: Readonly<{ id: string; extension: string }>): Promise<boolean> {
    try {
      await access(this.resolve(kind, input.id, input.extension));
      return true;
    } catch {
      return false;
    }
  }

  async list(kind: "pending" | "final"): Promise<readonly DocumentStorageArtifact[]> {
    const directory = this.directory(kind);
    let names: string[];
    try {
      names = await readdir(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const artifacts: DocumentStorageArtifact[] = [];
    for (const name of names) {
      const match = /^([0-9a-f-]{36})\.(pdf|docx|txt|md|png|jpg)$/i.exec(name);
      if (!match || !internalIdPattern.test(match[1])) continue;
      const metadata = await stat(path.join(directory, name));
      if (metadata.isFile()) {
        artifacts.push({ id: match[1], extension: match[2].toLowerCase(), modifiedAt: metadata.mtimeMs });
      }
    }
    return artifacts;
  }
}
