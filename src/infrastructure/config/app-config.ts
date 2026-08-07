import path from "node:path";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL: z.enum(["0", "1"]).optional(),
});

export type AppConfig = Readonly<{
  app: Readonly<{
    environment: "development" | "test" | "production";
    isVercel: boolean;
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

  return {
    app: {
      environment: parsed.NODE_ENV,
      isVercel,
    },
    database: {
      dataDirectory: isVercel
        ? "/tmp/mentor-platform"
        : path.join(workingDirectory, "data"),
      filename: "mentor.db",
    },
  };
}
