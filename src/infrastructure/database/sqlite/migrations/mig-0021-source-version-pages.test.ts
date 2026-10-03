import { expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SqliteExecutor } from "../sqlite-executor";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import { coreMigrationRegistry } from "./core-migration-registry";
import { MigrationRegistry } from "./migration-registry";
import { sourceVersionPagesMigration } from "./definitions/mig-0021-source-version-pages";
import { migrationChecksum } from "./migration-checksum";
import { DatabaseMigrationPreflight } from "../preflight/database-migration-preflight";

it("upgrades synthetic v20 atomically, preserves history/legacy rows without backfill and is idempotent",()=>{
  const s=new DatabaseSync(":memory:");
  try {
    const db:SqliteExecutor={all:<T>(sql:string,...p:SQLInputValue[])=>s.prepare(sql).all(...p) as T[],run:(sql,...p)=>s.prepare(sql).run(...p)};
    const v20=new MigrationRegistry(coreMigrationRegistry.migrations.filter(m=>m.toVersion<=20));
    new FreshDatabaseBootstrap(db,v20).run();
    s.exec("INSERT INTO document_import_journal(storage_id,extension,display_name,media_type,size,subject,document_status,content,state,created_at) VALUES('old','pdf','old','application/pdf',1,'x','Prêt','legacy','pending',1)");
    const history=s.prepare("SELECT * FROM schema_migrations ORDER BY to_version").all();
    expect(new DatabaseMigrationPreflight(db).inspect()).toMatchObject({
      currentVersion: 20,
      targetVersion: 21,
      pendingMigrations: ["MIG-0021"],
    });
    expect(new FreshDatabaseBootstrap(db).run()).toEqual({currentVersion:21,appliedMigrationIds:["MIG-0021"]});
    expect(s.prepare("SELECT * FROM schema_migrations WHERE to_version<=20 ORDER BY to_version").all()).toEqual(history);
    expect(s.prepare("SELECT pages_json,content,state FROM document_import_journal").get()).toEqual({pages_json:null,content:"legacy",state:"pending"});
    expect(s.prepare("SELECT * FROM source_version_pages").all()).toEqual([]);
    expect(s.prepare("SELECT checksum FROM schema_migrations WHERE to_version=21").get()).toEqual({checksum:migrationChecksum(sourceVersionPagesMigration)});
    expect(new FreshDatabaseBootstrap(db).run()).toEqual({currentVersion:21,appliedMigrationIds:[]});
    expect(new DatabaseMigrationPreflight(db).inspect()).toMatchObject({currentVersion:21,pendingMigrations:[]});
    expect(s.prepare("PRAGMA integrity_check").get()).toEqual({integrity_check:"ok"});
    s.exec("PRAGMA foreign_keys=ON");
    expect(()=>s.prepare("INSERT INTO source_version_pages VALUES('missing',1,'text')").run()).toThrow();
    s.exec("PRAGMA foreign_keys=OFF");
    expect(()=>s.prepare("INSERT INTO source_version_pages VALUES('x',0,'text')").run()).toThrow();
    expect(()=>s.prepare("INSERT INTO source_version_pages VALUES('x',1.5,'text')").run()).toThrow();
    s.prepare("INSERT INTO source_version_pages VALUES('x',1,'text')").run();
    expect(()=>s.prepare("INSERT INTO source_version_pages VALUES('x',1,'text')").run()).toThrow();
  } finally{s.close();}
}, 20_000);
