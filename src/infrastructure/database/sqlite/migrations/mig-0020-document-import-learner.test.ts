import { describe, expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { coreMigrationRegistry } from "./core-migration-registry";
import { MigrationRegistry } from "./migration-registry";
import { FreshDatabaseBootstrap } from "./fresh-database-bootstrap";
import type { SqliteExecutor } from "../sqlite-executor";
import { documentImportLearnerMigration } from "./definitions/mig-0020-document-import-learner";
import { migrationChecksum } from "./migration-checksum";

describe("MIG-0020", () => {
  it("upgrades v19 additively, preserves history and leaves legacy ownership unknown", () => {
    const sqlite=new DatabaseSync(":memory:");
    try {
      const db:SqliteExecutor={all:<T>(sql:string,...p:SQLInputValue[])=>sqlite.prepare(sql).all(...p) as T[],run:(sql,...p)=>sqlite.prepare(sql).run(...p)};
      new FreshDatabaseBootstrap(db,new MigrationRegistry(coreMigrationRegistry.migrations.filter(m=>m.toVersion<=19))).run();
      const history=sqlite.prepare("SELECT * FROM schema_migrations ORDER BY to_version").all();
      sqlite.exec("INSERT INTO document_import_journal(storage_id,extension,display_name,media_type,size,subject,document_status,content,state,created_at) VALUES('legacy','txt','old','text/plain',1,'SNC','Prêt','text','pending',1)");
      new FreshDatabaseBootstrap(db).run();
      expect(sqlite.prepare("SELECT * FROM schema_migrations WHERE to_version<=19 ORDER BY to_version").all()).toEqual(history);
      expect(sqlite.prepare("SELECT learner_id,state FROM document_import_journal").get()).toEqual({learner_id:null,state:"pending"});
      expect(sqlite.prepare("SELECT checksum FROM schema_migrations WHERE to_version=20").get()).toEqual({checksum:migrationChecksum(documentImportLearnerMigration)});
      expect(sqlite.prepare("PRAGMA integrity_check").get()).toEqual({integrity_check:"ok"});
    } finally {sqlite.close();}
  });
});
