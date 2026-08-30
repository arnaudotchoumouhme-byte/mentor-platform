import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { SqliteExecutor } from "../sqlite-executor";
import { coreMigrationRegistry } from "./definitions/mig-0001-core-baseline";
import { pilotProvisioningAuditMigration } from "./definitions/mig-0013-pilot-provisioning-audit";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { migrationChecksum } from "./migration-checksum";
import { MigrationRegistry } from "./migration-registry";

const executor = (sqlite: DatabaseSync): SqliteExecutor => ({ all:<T>(sql:string,...params:SQLInputValue[])=>sqlite.prepare(sql).all(...params) as T[], run:(sql:string,...params:SQLInputValue[])=>sqlite.prepare(sql).run(...params) });
const v12 = new MigrationRegistry(coreMigrationRegistry.migrations.filter(migration => migration.id !== "MIG-0013"));

describe("MIG-0013 pilot provisioning audit", () => {
  it("bootstraps a fresh synthetic database through v13", () => {
    const sqlite = new DatabaseSync(":memory:"); new FreshDatabaseBootstrap(executor(sqlite), coreMigrationRegistry).run();
    expect(sqlite.prepare("SELECT COUNT(*) count FROM schema_migrations").get()).toEqual({count:13});
    expect(sqlite.prepare("SELECT checksum FROM schema_migrations WHERE migration_id='MIG-0013'").get()).toEqual({checksum:migrationChecksum(pilotProvisioningAuditMigration)});
    sqlite.close();
  });
  it("migrates v12 to v13 additively and preserves pilot data", () => {
    const sqlite = new DatabaseSync(":memory:"); const db = executor(sqlite); new FreshDatabaseBootstrap(db, v12).run();
    sqlite.prepare("INSERT INTO accounts VALUES(?,?,?,?,?,?)").run("a","auth0|a","learner-a","ACTIVE","now","now");
    expect(new FreshDatabaseBootstrap(db, coreMigrationRegistry).run()).toMatchObject({currentVersion:13,appliedMigrationIds:["MIG-0013"]});
    expect(sqlite.prepare("SELECT oidc_subject FROM accounts WHERE account_id='a'").get()).toEqual({oidc_subject:"auth0|a"});
    expect(sqlite.prepare("PRAGMA integrity_check").get()).toEqual({integrity_check:"ok"}); sqlite.close();
  });
});
