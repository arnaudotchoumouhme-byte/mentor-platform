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
  it("refuse une production Render sans garde-fou persistant ou avec les données de démonstration",()=>{
    expect(()=>createAppConfig({NODE_ENV:"production",RENDER:"true",MENTOR_ENABLE_DEMO_DATA:"0"},"C:\\mentor")).toThrow("stockage persistant");
    expect(()=>createAppConfig({NODE_ENV:"production",RENDER:"true",MENTOR_ENABLE_DEMO_DATA:"1",MENTOR_REQUIRE_PERSISTENT_STORAGE:"1",MENTOR_PERSISTENT_MOUNT_PATH:"/persistent",MENTOR_DATA_DIRECTORY:"/persistent/data"},"C:\\mentor")).toThrow("MENTOR_ENABLE_DEMO_DATA");
  });
  it("accepte une production Render explicitement liée au montage durable",()=>{
    const config=createAppConfig({NODE_ENV:"production",RENDER:"true",MENTOR_ENABLE_DEMO_DATA:"0",MENTOR_REQUIRE_PERSISTENT_STORAGE:"1",MENTOR_PERSISTENT_MOUNT_PATH:"/opt/render/project/src/persistent",MENTOR_DATA_DIRECTORY:"/opt/render/project/src/persistent/data",AUTH0_DOMAIN:"tenant.auth0.com",AUTH0_CLIENT_ID:"client",AUTH0_CLIENT_SECRET:"client-secret",AUTH0_SECRET:"12345678901234567890123456789012",APP_BASE_URL:"https://mentor.example",MENTOR_PILOT_PROVISIONER_SUBJECTS:"auth0|operator",MENTOR_PILOT_OSCE_SESSION_LIMIT:"10",MENTOR_PILOT_AI_REQUEST_LIMIT:"10",MENTOR_PILOT_QUOTA_WINDOW_DAYS:"30",MENTOR_PILOT_AUDIT_KEY:"12345678901234567890123456789012"},"C:\\mentor");
    expect(config.database).toMatchObject({requirePersistentStorage:true,persistentMountPath:"/opt/render/project/src/persistent"});
  });
  it("refuse une production Render sans Auth0 ou provisioning complet",()=>{
    const base={NODE_ENV:"production",RENDER:"true",MENTOR_ENABLE_DEMO_DATA:"0",MENTOR_REQUIRE_PERSISTENT_STORAGE:"1",MENTOR_PERSISTENT_MOUNT_PATH:"/persistent",MENTOR_DATA_DIRECTORY:"/persistent/data"} as const;
    expect(()=>createAppConfig(base,"C:\\mentor")).toThrow("CFG_AUTH0_INCOMPLETE");
  });

});
