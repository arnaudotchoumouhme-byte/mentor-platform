import "server-only";

import { createEnvironmentAiConfiguration } from "./ai-configuration";

export const aiConfiguration = createEnvironmentAiConfiguration(
  () => process.env,
);
