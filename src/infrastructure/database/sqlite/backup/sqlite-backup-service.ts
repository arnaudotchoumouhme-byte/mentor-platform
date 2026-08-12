import { backup, DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  BACKUP_DATABASE_FILE,
  BACKUP_FORMAT_VERSION,
  BACKUP_MANIFEST_FILE,
  BackupError,
  type BackupManifest,
  type VerifiedBackup,
} from "./backup-model";

function checksum(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function sqliteFileStateFingerprint(databasePath: string): Promise<string> {
  const snapshotDirectory = await mkdtemp(path.join(tmpdir(), "mentor-sqlite-state-"));
  const snapshotPath = path.join(snapshotDirectory, "snapshot.sqlite");
  let source: DatabaseSync | undefined;
  try {
    source = new DatabaseSync(databasePath, { readOnly: true });
    source.exec("PRAGMA query_only=ON");
    await backup(source, snapshotPath);
    return await fileChecksum(snapshotPath);
  } catch (cause) {
    if (cause instanceof BackupError) throw cause;
    throw new BackupError(
      "BACKUP_CREATION_FAILED",
      "Unable to fingerprint the logical SQLite database state.",
      { cause },
    );
  } finally {
    source?.close();
    await rm(snapshotDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function fileChecksum(filePath: string): Promise<string> {
  return checksum(await readFile(filePath));
}

function backupId(now: Date): string {
  const timestamp = now.toISOString().replace(/[-:.TZ]/g, "");
  return `BKP-${timestamp}-${randomUUID().slice(0, 8)}`;
}

function isManifest(value: unknown): value is BackupManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<BackupManifest>;
  return (
    typeof manifest.backupId === "string" &&
    typeof manifest.createdAt === "string" &&
    (manifest.applicationVersion === null || typeof manifest.applicationVersion === "string") &&
    Number.isInteger(manifest.schemaVersion) &&
    manifest.backupFormatVersion === BACKUP_FORMAT_VERSION &&
    manifest.databaseFile === BACKUP_DATABASE_FILE &&
    typeof manifest.databaseChecksum === "string" &&
    /^[a-f0-9]{64}$/.test(manifest.databaseChecksum) &&
    manifest.sourceDatabaseIdentity?.kind === "SQLITE_FILE" &&
    typeof manifest.sourceDatabaseIdentity.fileName === "string" &&
    path.basename(manifest.sourceDatabaseIdentity.fileName) === manifest.sourceDatabaseIdentity.fileName &&
    typeof manifest.sourceDatabaseFingerprint === "string" &&
    /^[a-f0-9]{64}$/.test(manifest.sourceDatabaseFingerprint) &&
    manifest.status === "COMPLETE"
  );
}

function verifySqlite(filePath: string): number | null {
  const database = new DatabaseSync(filePath, { readOnly: true });
  try {
    const result = database.prepare("PRAGMA integrity_check").get() as { integrity_check?: string };
    if (result.integrity_check !== "ok") {
      throw new BackupError("BACKUP_VERIFICATION_FAILED", "SQLite backup integrity check failed.");
    }
    const objects = database.prepare("SELECT type,name FROM sqlite_schema ORDER BY type,name").all() as { name: string }[];
    if (!objects.some(({ name }) => name === "schema_migrations")) return null;
    const row = database.prepare("SELECT MAX(to_version) AS version FROM schema_migrations").get() as { version: number | null };
    return row.version ?? 0;
  } finally {
    database.close();
  }
}

export class SqliteBackupService {
  async create(input: Readonly<{
    sourceDatabase: DatabaseSync;
    sourcePath: string;
    destinationDirectory: string;
    schemaVersion: number;
    applicationVersion?: string | null;
    now?: Date;
  }>): Promise<VerifiedBackup> {
    const id = backupId(input.now ?? new Date());
    const packageDirectory = path.join(input.destinationDirectory, id);
    const databaseFile = path.join(packageDirectory, BACKUP_DATABASE_FILE);
    try {
      await mkdir(input.destinationDirectory, { recursive: true, mode: 0o700 });
      await mkdir(packageDirectory, { mode: 0o700 });
      await backup(input.sourceDatabase, databaseFile);
      await chmod(databaseFile, 0o600);
      verifySqlite(databaseFile);
      const databaseChecksum = await fileChecksum(databaseFile);
      const manifest: BackupManifest = Object.freeze({
        backupId: id,
        createdAt: (input.now ?? new Date()).toISOString(),
        applicationVersion: input.applicationVersion ?? null,
        schemaVersion: input.schemaVersion,
        backupFormatVersion: BACKUP_FORMAT_VERSION,
        databaseFile: BACKUP_DATABASE_FILE,
        databaseChecksum,
        sourceDatabaseIdentity: Object.freeze({
          kind: "SQLITE_FILE",
          fileName: path.basename(input.sourcePath),
        }),
        sourceDatabaseFingerprint: databaseChecksum,
        status: "COMPLETE",
      });
      await writeFile(
        path.join(packageDirectory, BACKUP_MANIFEST_FILE),
        `${JSON.stringify(manifest, null, 2)}\n`,
        { encoding: "utf8", mode: 0o600, flag: "wx" },
      );
      return await this.verify(packageDirectory);
    } catch (cause) {
      await rm(packageDirectory, { recursive: true, force: true }).catch(() => undefined);
      if (cause instanceof BackupError) throw cause;
      throw new BackupError("BACKUP_CREATION_FAILED", "Verified SQLite backup creation failed.", { cause });
    }
  }

  async verify(packageDirectory: string): Promise<VerifiedBackup> {
    try {
      const manifestPath = path.join(packageDirectory, BACKUP_MANIFEST_FILE);
      const raw = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
      if (!isManifest(raw)) {
        throw new BackupError("BACKUP_MANIFEST_INVALID", "Backup manifest is invalid or unsupported.");
      }
      const databasePath = path.join(packageDirectory, raw.databaseFile);
      await access(databasePath, constants.R_OK);
      if (!(await stat(databasePath)).isFile()) {
        throw new BackupError("BACKUP_VERIFICATION_FAILED", "Backup database artifact is not a file.");
      }
      if ((await fileChecksum(databasePath)) !== raw.databaseChecksum) {
        throw new BackupError("BACKUP_CHECKSUM_MISMATCH", "Backup database checksum does not match its manifest.");
      }
      const storedVersion = verifySqlite(databasePath);
      if (storedVersion !== null && storedVersion !== raw.schemaVersion) {
        throw new BackupError("BACKUP_VERIFICATION_FAILED", "Backup schema version does not match its manifest.");
      }
      return Object.freeze({ status: "VERIFIED", packageDirectory, manifest: Object.freeze(raw) });
    } catch (cause) {
      if (cause instanceof BackupError) throw cause;
      throw new BackupError("BACKUP_VERIFICATION_FAILED", "Backup package verification failed.", { cause });
    }
  }

  async restoreToStaging(
    backupEvidence: VerifiedBackup,
    stagingDatabasePath: string,
    activeDatabasePath?: string,
  ): Promise<Readonly<{ status: "RESTORED_STAGING"; databasePath: string }>> {
    let stagingCreated = false;
    const resolvedStaging = path.resolve(stagingDatabasePath);
    try {
      const verified = await this.verify(backupEvidence.packageDirectory);
      if (activeDatabasePath && resolvedStaging === path.resolve(activeDatabasePath)) {
        throw new BackupError("RESTORE_FAILED", "Restore target must not be the active database.");
      }
      await mkdir(path.dirname(resolvedStaging), { recursive: true, mode: 0o700 });
      await copyFile(
        path.join(verified.packageDirectory, verified.manifest.databaseFile),
        resolvedStaging,
        constants.COPYFILE_EXCL,
      );
      stagingCreated = true;
      await chmod(resolvedStaging, 0o600);
      if ((await fileChecksum(resolvedStaging)) !== verified.manifest.databaseChecksum) {
        throw new BackupError("RESTORE_VERIFICATION_FAILED", "Staged restore checksum verification failed.");
      }
      verifySqlite(resolvedStaging);
      return Object.freeze({ status: "RESTORED_STAGING", databasePath: resolvedStaging });
    } catch (cause) {
      if (stagingCreated) await rm(resolvedStaging, { force: true }).catch(() => undefined);
      if (cause instanceof BackupError) throw cause;
      throw new BackupError("RESTORE_FAILED", "Staged restore failed.", { cause });
    }
  }
}
