import { access, stat, statfs } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import type { AppConfig } from "@/infrastructure/config/app-config";

export type DatabasePathDiscovery = Readonly<{
  resolvedPath: string;
  safeDescriptor: string;
  exists: boolean;
  isFile: boolean;
  sizeBytes: number | null;
  readable: boolean;
  writePermissionExpected: boolean;
  availableDiskBytes: number | null;
  diskSpaceSufficient: boolean | null;
}>;

async function permitted(filePath: string, mode: number): Promise<boolean> {
  return access(filePath, mode).then(() => true, () => false);
}

export async function discoverDatabasePath(config: AppConfig): Promise<DatabasePathDiscovery> {
  const resolvedPath = path.resolve(config.database.dataDirectory, config.database.filename);
  try {
    const metadata = await stat(resolvedPath);
    const disk = await statfs(path.dirname(resolvedPath)).catch(() => null);
    return Object.freeze({
      resolvedPath,
      safeDescriptor: path.basename(resolvedPath),
      exists: true,
      isFile: metadata.isFile(),
      sizeBytes: metadata.isFile() ? metadata.size : null,
      readable: await permitted(resolvedPath, constants.R_OK),
      writePermissionExpected: await permitted(resolvedPath, constants.W_OK),
      availableDiskBytes: disk ? Number(disk.bavail) * Number(disk.bsize) : null,
      diskSpaceSufficient: disk
        ? Number(disk.bavail) * Number(disk.bsize) >= Math.max(metadata.size * 3, 16 * 1024 * 1024)
        : null,
    });
  } catch {
    return Object.freeze({
      resolvedPath,
      safeDescriptor: path.basename(resolvedPath),
      exists: false,
      isFile: false,
      sizeBytes: null,
      readable: false,
      writePermissionExpected: false,
      availableDiskBytes: null,
      diskSpaceSufficient: null,
    });
  }
}
