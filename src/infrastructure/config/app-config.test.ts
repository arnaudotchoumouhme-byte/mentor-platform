import path from "node:path";
import { describe, expect, it } from "vitest";
import { createAppConfig } from "./app-config";

describe("createAppConfig", () => {
  it("conserve le répertoire de données local actuel", () => {
    const config = createAppConfig({ NODE_ENV: "test" }, "C:\\mentor");

    expect(config.database.dataDirectory).toBe(path.join("C:\\mentor", "data"));
    expect(config.database.filename).toBe("mentor.db");
    expect(config.app.isVercel).toBe(false);
    expect(config.app.demoDataEnabled).toBe(true);
  });

  it("conserve le répertoire temporaire actuel sur Vercel", () => {
    const config = createAppConfig(
      { NODE_ENV: "production", VERCEL: "1" },
      "C:\\mentor",
    );

    expect(config.database.dataDirectory).toBe("/tmp/mentor-platform");
    expect(config.app.isVercel).toBe(true);
  });

  it("permet de désactiver explicitement les données de démonstration", () => {
    const config = createAppConfig(
      { NODE_ENV: "test", MENTOR_ENABLE_DEMO_DATA: "0" },
      "C:\\mentor",
    );

    expect(config.app.demoDataEnabled).toBe(false);
  });

  it("accepte un répertoire de données absolu pour les environnements isolés", () => {
    const config = createAppConfig(
      { NODE_ENV: "test", MENTOR_DATA_DIRECTORY: "C:\\temp\\mentor-test" },
      "C:\\mentor",
    );

    expect(config.database.dataDirectory).toBe("C:\\temp\\mentor-test");
  });

  it("refuse un répertoire de données relatif", () => {
    expect(() =>
      createAppConfig(
        { NODE_ENV: "test", MENTOR_DATA_DIRECTORY: "relative/data" },
        "C:\\mentor",
      ),
    ).toThrow("chemin absolu");
  });

});
