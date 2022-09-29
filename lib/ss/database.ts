import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { Sqlite } from "./sqlite";
import { SSDocument, SSViewOptions } from "./types";
import { SSView } from "./view";
import { initCollation } from "../collation";
import { bindNames, bindObject, bindVars } from "./util";

const dbName = "store.db";

interface SSConfig {
  viewRoot: string;
}

type SSOptions = Partial<SSConfig>;

const defaultOptions: SSConfig = {
  viewRoot: "."
};

export class SSDatabase {
  dir: string;
  config: SSConfig;

  #db: Sqlite;
  #insert: Database.Transaction;
  #since: Database.Statement;

  #views: Record<string, SSView> = {};

  private constructor(dir: string, options: SSOptions) {
    this.dir = dir;
    this.config = { ...defaultOptions, ...options };
    this.#db = new Sqlite(path.join(dir, dbName));
    this.makeTables();
    this.prepareStatements();
  }

  private makeTables() {
    const sql = [
      `CREATE TABLE IF NOT EXISTS "store" (` +
        `  oid INTEGER PRIMARY KEY AUTOINCREMENT,` +
        `  ts INTEGER NOT NULL,` +
        `  id TEXT NOT NULL,` +
        `  rev TEXT NOT NULL,` +
        `  deleted INTEGER NOT NULL,` +
        `  doc TEXT NOT NULL` +
        `)`,
      ["ts", "id", "rev"].map(
        col =>
          `CREATE INDEX IF NOT EXISTS` + `  "store-${col}" ON "store"("${col}")`
      )
    ];
    sql.flat().map(s => this.#db.prepare(s).run());
  }

  private prepareStatements() {
    const insertDoc = this.#db.prepare(
      `INSERT INTO "store" ("ts", "id", "rev", "deleted", "doc")` +
        `  VALUES (@ts, @id, @rev, @deleted, @doc)`
    );

    this.#insert = this.#db.transaction(docs => {
      const ts = new Date().getTime();

      for (const doc of docs)
        insertDoc.run({
          ts,
          id: doc._id,
          rev: doc._rev,
          deleted: doc._deleted ? 1 : 0,
          doc: JSON.stringify(doc)
        });
    });

    this.#since = this.#db.prepare(
      `SELECT * FROM "store" ` +
        ` WHERE "oid" IN (` +
        `   SELECT MAX("oid") AS "oid" FROM "store"` +
        `     WHERE "oid" > @oid` +
        `     GROUP BY "id"` +
        `)`
    );
  }

  static async create(dir: string, options: SSOptions = {}) {
    await initCollation();
    await fs.promises.mkdir(dir, { recursive: true });
    return new SSDatabase(dir, options);
  }

  insert(docs: SSDocument[]) {
    this.#insert(docs);
  }

  async getView(design: string, view: string) {
    const viewKey = [design, view].join("/");
    return (this.#views[viewKey] =
      this.#views[viewKey] || (await SSView.create(this, design, view)));
  }

  async view(design: string, view: string, opt: SSViewOptions = {}) {
    const v = await this.getView(design, view);
    return v.query(opt);
  }

  since(oid: number = 0) {
    return this.#since.iterate({ oid });
  }

  loadByOID(oids: number[]) {
    const names = bindNames("o")(oids);
    const bind = bindObject(names)(oids);
    return this.#db
      .learn(
        `SELECT "oid", "doc" FROM "store" WHERE "oid" IN (${bindVars(names)})`
      )
      .all(bind)
      .map(({ oid, doc }) => ({ oid, doc: JSON.parse(doc) }));
  }
}
