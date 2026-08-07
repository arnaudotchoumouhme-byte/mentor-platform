import "server-only";

import { createAppConfig } from "./app-config";

export const config = createAppConfig(process.env, process.cwd());
