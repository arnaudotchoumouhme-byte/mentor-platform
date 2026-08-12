import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { ChunkIdentityPort } from "@/application/rag/paragraph-chunker";

export class NodeChunkIdentity implements ChunkIdentityPort {
  id(): string { return randomUUID(); }
  hash(text: string): string { return createHash("sha256").update(text).digest("hex"); }
}
