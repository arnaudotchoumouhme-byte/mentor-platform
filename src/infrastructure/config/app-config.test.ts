import path from "node:path";
import { describe, expect, it } from "vitest";
import { createAppConfig } from "./app-config";

describe("createAppConfig", () => {
  it("conserve le répertoire de données local actuel", () => {
    const config = createAppConfig({ NODE_ENV: "test" }, "C:\\mentor");

    expect(config.database.dataDirectory).toBe(path.join("C:\\mentor", "data"));
    expect(config.database.filename).toBe("mentor.db");
    expect(config.app.isVercel).toBe(false);
  });

  it("conserve le répertoire temporaire actuel sur Vercel", () => {
    const config = createAppConfig(
      { NODE_ENV: "production", VERCEL: "1" },
      "C:\\mentor",
    );

    expect(config.database.dataDirectory).toBe("/tmp/mentor-platform");
    expect(config.app.isVercel).toBe(true);
  });

});
