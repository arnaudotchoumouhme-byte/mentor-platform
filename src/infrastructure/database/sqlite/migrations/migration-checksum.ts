import { createHash } from "node:crypto";
import type { MigrationDefinition } from "./migration-definition";

function normalizeIntegrityText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function migrationChecksum(
  migration: MigrationDefinition,
): string {
  // Runtime state and function source are intentionally excluded. Authors must
  // update checksumMaterial whenever the migration operation changes semantics.
  const canonicalDefinition = JSON.stringify({
    id: migration.id,
    fromVersion: migration.fromVersion,
    toVersion: migration.toVersion,
    description: migration.description.trim(),
    checksumMaterial: migration.checksumMaterial.map(normalizeIntegrityText),
  });

  return createHash("sha256").update(canonicalDefinition, "utf8").digest("hex");
}
