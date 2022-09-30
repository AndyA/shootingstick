import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { Sqlite } from "./sqlite";
import {
  isSSBulkRowOK,
  SSBulkRow,
  SSBulkRowError,
  SSBulkRowOK,
  SSBulkResult,
  SSDocument,
  SSFreeDocument,
  SSViewOptions,
  isSSBulkRowError
} from "./types";
import { SSView } from "./view";
import { initCollation } from "../collation";
import { bindNames, bindObject, bindVars, nextRev } from "./util";
import { groupBy, keyBy, uniq } from "lodash";

const dbName = "store.db";

export interface SSConfig {
  viewRoot: string;
}

export type SSOptions = Partial<SSConfig>;

interface WorkSlot {
  result: SSBulkRow;
  doc: SSFreeDocument;
}

const defaultOptions: SSConfig = {
  viewRoot: "."
};

const noid: SSBulkRowError = {
  id: "",
  error: "noid",
  reason: "Documents must have an _id string"
};

export class SSDatabase {
  dir: string;
  config: SSConfig;

  #db: Sqlite;
  #insert: Database.Transaction;
  #bulkUpdate: Database.Transaction;
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

    this.#bulkUpdate = this.#db.transaction((docs: SSFreeDocument[]) => {
      // const ids = work.filter(isSSBulkRowOK);
      // const revs = probe.all(bind());
      const work: WorkSlot[] = docs.map(doc =>
        typeof doc._id === "string"
          ? { doc, result: { id: doc._id, ok: true, rev: "" } }
          : { doc, result: noid }
      );

      const todo = work.filter(({ result }) => isSSBulkRowOK(result));
      const ids = todo.map(({ result }) => result.id);

      const names = bindNames("id")(todo);

      // Find any current versions
      const revs = keyBy(
        this.#db
          .learn(
            `SELECT "id", "rev" FROM "store" ` +
              ` WHERE "oid" IN (` +
              `   SELECT MAX("oid") AS "oid" FROM "store"` +
              `     WHERE "id" IN (${bindVars(names)})` +
              `     GROUP BY "id"` +
              `)`
          )
          .all(bindObject(names)(ids)),
        "id"
      );

      // Check for conflicts
      for (const slot of todo) {
        const { doc } = slot;
        const rev = revs[doc._id]?.rev;
        if (doc._rev !== rev) {
          slot.result = {
            id: doc._id,
            error: "conflict",
            reason: "Document update conflict"
          };
        }
      }

      // Allocate revisions to docs
      for (const slot of todo) {
        if (isSSBulkRowError(slot.result)) continue;
        const _rev = nextRev(slot.doc);
        slot.doc = { ...slot.doc, _rev };
        slot.result.rev = _rev;
      }

      const ts = new Date().getTime();

      // Commit the documents
      for (const { doc, result } of todo) {
        if (isSSBulkRowError(result)) continue;
        insertDoc.run({
          ts,
          id: doc._id,
          rev: doc._rev,
          deleted: doc._deleted ? 1 : 0,
          doc: JSON.stringify(doc)
        });
      }

      return work.map(({ result }) => result);
    });
  }

  static async create(dir: string, options: SSOptions = {}) {
    await initCollation();
    await fs.promises.mkdir(dir, { recursive: true });
    return new SSDatabase(dir, options);
  }

  insert(docs: SSDocument[]) {
    this.#insert(docs);
  }

  bulk(docs: SSFreeDocument[]) {
    return this.#bulkUpdate(docs);
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

  load(ids: string[]) {
    const uids = uniq(ids);
    const names = bindNames("i")(uids);
    return this.#db
      .learn(
        `SELECT "doc" FROM "store" ` +
          ` WHERE "oid" IN (` +
          `   SELECT MAX("oid") AS "oid" FROM "store"` +
          `     WHERE "id" IN (${bindVars(names)})` +
          `     GROUP BY "id"` +
          `)`
      )
      .all(bindObject(names)(uids))
      .map(({ doc }) => JSON.parse(doc));
  }
}
