import path from "node:path";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL: z.enum(["0", "1"]).optional(),
  RENDER: z.enum(["true", "false"]).optional(),
  MENTOR_ENABLE_DEMO_DATA: z.enum(["0", "1"]).default("1"),
  MENTOR_REQUIRE_PERSISTENT_STORAGE: z.enum(["0", "1"]).default("0"),
  MENTOR_PERSISTENT_MOUNT_PATH: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().min(1).optional()),
  MENTOR_PILOT_PROVISIONER_SUBJECTS: z.string().default(""),
  MENTOR_PILOT_OSCE_SESSION_LIMIT: z.coerce.number().int().nonnegative().optional(),
  MENTOR_PILOT_AI_REQUEST_LIMIT: z.coerce.number().int().nonnegative().optional(),
  MENTOR_PILOT_QUOTA_WINDOW_DAYS: z.coerce.number().int().positive().max(366).optional(),
  MENTOR_PILOT_AUDIT_KEY: z.string().min(32).optional(),
  AUTH0_DOMAIN: z.string().trim().min(1).optional(),
  AUTH0_CLIENT_ID: z.string().trim().min(1).optional(),
  AUTH0_CLIENT_SECRET: z.string().trim().min(1).optional(),
  AUTH0_SECRET: z.string().trim().min(32).optional(),
  APP_BASE_URL: z.string().url().optional(),
  MENTOR_DATA_DIRECTORY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
});

export type AppConfig = Readonly<{
  app: Readonly<{
    environment: "development" | "test" | "production";
    isVercel: boolean;
    isRender: boolean;
    demoDataEnabled: boolean;
  }>;
  database: Readonly<{
    dataDirectory: string;
    filename: string;
    requirePersistentStorage: boolean;
    persistentMountPath: string | null;
  }>;
  pilot: Readonly<{
    provisionerSubjects: readonly string[];
    osceSessionLimit: number | null;
    aiRequestLimit: number | null;
    quotaWindowDays: number | null;
    auditKey: string | null;
  }>;
}>;

export function createAppConfig(
  environment: NodeJS.ProcessEnv,
  workingDirectory: string,
): AppConfig {
  const parsed = environmentSchema.parse(environment);
  const isVercel = parsed.VERCEL === "1";
  const isRender = parsed.RENDER === "true";
  if (parsed.MENTOR_DATA_DIRECTORY && !path.isAbsolute(parsed.MENTOR_DATA_DIRECTORY)) {
    throw new Error("MENTOR_DATA_DIRECTORY doit être un chemin absolu.");
  }
  if (parsed.MENTOR_PERSISTENT_MOUNT_PATH && !path.isAbsolute(parsed.MENTOR_PERSISTENT_MOUNT_PATH)) throw new Error("MENTOR_PERSISTENT_MOUNT_PATH doit être un chemin absolu.");
  if (parsed.MENTOR_REQUIRE_PERSISTENT_STORAGE === "1" && !parsed.MENTOR_PERSISTENT_MOUNT_PATH) throw new Error("MENTOR_PERSISTENT_MOUNT_PATH est requis lorsque le stockage persistant est obligatoire.");
  if (parsed.NODE_ENV === "production" && isRender && parsed.MENTOR_ENABLE_DEMO_DATA !== "0") throw new Error("MENTOR_ENABLE_DEMO_DATA doit être 0 en production Render.");
  if (parsed.NODE_ENV === "production" && isRender && parsed.MENTOR_REQUIRE_PERSISTENT_STORAGE !== "1") throw new Error("Le stockage persistant doit être obligatoire en production Render.");
  if (parsed.NODE_ENV === "production" && isRender) {
    const missingAuth0 = ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET", "APP_BASE_URL"].filter(key => !environment[key]);
    if (missingAuth0.length) throw new Error(`CFG_AUTH0_INCOMPLETE: ${missingAuth0.join(",")}`);
    if (!parsed.MENTOR_PILOT_PROVISIONER_SUBJECTS.trim() || parsed.MENTOR_PILOT_OSCE_SESSION_LIMIT === undefined || parsed.MENTOR_PILOT_AI_REQUEST_LIMIT === undefined || parsed.MENTOR_PILOT_QUOTA_WINDOW_DAYS === undefined || !parsed.MENTOR_PILOT_AUDIT_KEY) throw new Error("CFG_PILOT_PROVISIONING_INCOMPLETE");
  }

  return {
    app: {
      environment: parsed.NODE_ENV,
      isVercel,
      isRender,
      demoDataEnabled: parsed.MENTOR_ENABLE_DEMO_DATA === "1",
    },
    database: {
      dataDirectory:
        parsed.MENTOR_DATA_DIRECTORY ??
        (isVercel ? "/tmp/mentor-platform" : path.join(workingDirectory, "data")),
      filename: "mentor.db",
      requirePersistentStorage: parsed.MENTOR_REQUIRE_PERSISTENT_STORAGE === "1",
      persistentMountPath: parsed.MENTOR_PERSISTENT_MOUNT_PATH ?? null,
    },
    pilot: {
      provisionerSubjects: Object.freeze(parsed.MENTOR_PILOT_PROVISIONER_SUBJECTS.split(",").map(value => value.trim()).filter(Boolean)),
      osceSessionLimit: parsed.MENTOR_PILOT_OSCE_SESSION_LIMIT ?? null,
      aiRequestLimit: parsed.MENTOR_PILOT_AI_REQUEST_LIMIT ?? null,
      quotaWindowDays: parsed.MENTOR_PILOT_QUOTA_WINDOW_DAYS ?? null,
      auditKey: parsed.MENTOR_PILOT_AUDIT_KEY ?? null,
    },
  };
}
