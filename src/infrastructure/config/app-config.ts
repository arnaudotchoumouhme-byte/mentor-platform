import path from "node:path";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL: z.enum(["0", "1"]).optional(),
  MENTOR_ENABLE_DEMO_DATA: z.enum(["0", "1"]).default("1"),
  MENTOR_DATA_DIRECTORY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
});

export type AppConfig = Readonly<{
  app: Readonly<{
    environment: "development" | "test" | "production";
    isVercel: boolean;
    demoDataEnabled: boolean;
  }>;
  database: Readonly<{
    dataDirectory: string;
    filename: string;
  }>;
}>;

export function createAppConfig(
  environment: NodeJS.ProcessEnv,
  workingDirectory: string,
): AppConfig {
  const parsed = environmentSchema.parse(environment);
  const isVercel = parsed.VERCEL === "1";
  if (parsed.MENTOR_DATA_DIRECTORY && !path.isAbsolute(parsed.MENTOR_DATA_DIRECTORY)) {
    throw new Error("MENTOR_DATA_DIRECTORY doit être un chemin absolu.");
  }

  return {
    app: {
      environment: parsed.NODE_ENV,
      isVercel,
      demoDataEnabled: parsed.MENTOR_ENABLE_DEMO_DATA === "1",
    },
    database: {
      dataDirectory:
        parsed.MENTOR_DATA_DIRECTORY ??
        (isVercel ? "/tmp/mentor-platform" : path.join(workingDirectory, "data")),
      filename: "mentor.db",
    },
  };
}
