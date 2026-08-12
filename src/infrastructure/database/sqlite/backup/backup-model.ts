export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_DATABASE_FILE = "mentor.sqlite";
export const BACKUP_MANIFEST_FILE = "manifest.json";

export type BackupState = "STARTING" | "COPYING" | "VERIFYING" | "COMPLETE" | "FAILED";

export type BackupManifest = Readonly<{
  backupId: string;
  createdAt: string;
  applicationVersion: string | null;
  schemaVersion: number;
  backupFormatVersion: number;
  databaseFile: typeof BACKUP_DATABASE_FILE;
  databaseChecksum: string;
  sourceDatabaseIdentity: Readonly<{
    kind: "SQLITE_FILE";
    fileName: string;
  }>;
  sourceDatabaseFingerprint: string;
  status: "COMPLETE";
}>;

export type VerifiedBackup = Readonly<{
  status: "VERIFIED";
  packageDirectory: string;
  manifest: BackupManifest;
}>;

export type RecoveryState =
  | "RECOVERY_AVAILABLE"
  | "BACKUP_INVALID"
  | "RESTORE_FAILED"
  | "DATABASE_INTEGRITY_FAILED"
  | "MIGRATION_PREFLIGHT_BLOCKED";

export type BackupErrorCode =
  | "BACKUP_CREATION_FAILED"
  | "BACKUP_VERIFICATION_FAILED"
  | "BACKUP_CHECKSUM_MISMATCH"
  | "BACKUP_MANIFEST_INVALID"
  | "RESTORE_FAILED"
  | "RESTORE_VERIFICATION_FAILED";

export class BackupError extends Error {
  constructor(readonly code: BackupErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BackupError";
  }
}
