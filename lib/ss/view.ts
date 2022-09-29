import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

import { uniq, last } from "lodash";
import Database from "better-sqlite3";

import { SSDatabase } from "./database";
import { sortKey } from "../collation";

import type { SSDocument, SSRecord, SSFocus } from "./types";
import type { KeyType } from "../collation";
import { sum, toJSON } from "./util";

const queueMax = 1000;

interface Update {
  verb: "update";
  oid: number;
  id: string;
  key: KeyType;
  value: any;
}

interface Delete {
  verb: "delete";
  oid: number;
  id: string;
}

interface Mark {
  verb: "mark";
  oid: number;
}

type Action = Update | Delete | Mark;

const isUpdate = (action: Action): action is Update => action.verb === "update";
const isDelete = (action: Action): action is Delete => action.verb === "delete";

export class SSView {
  store: SSDatabase;
  #viewDir: string;
  #dbDir: string;
  #db: Database.Database;

  #mapFn: (doc: SSDocument) => any;

  // Context for #mapFn
  #focus: SSFocus = null;

  // Insert queue
  #queue: Action[] = [];

  #update: Database.Transaction;
  #getState: Database.Statement;
  #setState: Database.Statement;

  private constructor(store: SSDatabase, viewDir: string, dbDir: string) {
    this.store = store;
    this.#viewDir = viewDir;
    this.#dbDir = dbDir;
    this.makeDatabase();
    this.prepareStatements();
  }

  static async create(
    db: SSDatabase,
    design: string,
    view: string
  ): Promise<SSView> {
    const viewDir = path.join(db.config.viewRoot, design, "views", view);
    const dbDir = path.join(db.dir, "views", design, view);
    await fs.promises.mkdir(dbDir, { recursive: true });

    const v = new SSView(db, viewDir, dbDir);
    await v.makeMapFn();

    return v;
  }

  private async makeMapFn() {
    const mapper = path.join(this.#viewDir, "map.js");
    const code = await fs.promises.readFile(mapper, "utf8");

    const log = console.log;
    const isArray = Array.isArray;

    const emit = (key: any, value: any): void => {
      const { oid, id } = this.#focus;
      this.#queue.push({ verb: "update", oid, id, key, value });
    };

    const context = { emit, toJSON, JSON, isArray, log, sum, exports: null };

    vm.createContext(context);
    this.#mapFn = vm.runInContext(code, context);
  }

  private makeDatabase() {
    const db = (this.#db = new Database(path.join(this.#dbDir, "view.db")));
    // Create the table
    const create =
      `CREATE TABLE IF NOT EXISTS "view" (` +
      `  "binkey" BLOB NOT NULL,` +
      `  "oid" INTEGER NOT NULL,` +
      `  "id" TEXT NOT NULL,` +
      `  "key" TEXT NOT NULL,` +
      `  "value" TEXT NOT NULL` +
      `)`;

    db.prepare(create).run();

    for (const col of ["binkey", "oid", "id"])
      db.prepare(
        `CREATE INDEX IF NOT EXISTS "view-${col}" ON "view"("${col}")`
      ).run();

    const state =
      `CREATE TABLE IF NOT EXISTS "state" (` +
      `  "id" TEXT NOT NULL, ` +
      `  "value" INTEGER NOT NULL, ` +
      `  PRIMARY KEY ("id")` +
      `)`;

    db.prepare(state).run();
  }

  private prepareStatements() {
    const db = this.#db;
    const del = db.prepare(`DELETE FROM "view" WHERE "id" = @id`);
    const ins = db.prepare(
      `INSERT INTO "view" ("binkey", "oid", "id", "key", "value")` +
        ` VALUES (@binkey, @oid, @id, @key, @value)`
    );

    this.#setState = db.prepare(
      `INSERT INTO "state" ("id", "value")` +
        `  VALUES (@id, @value)` +
        `  ON CONFLICT("id") DO UPDATE SET "value" = @value`
    );

    this.#getState = db.prepare(`SELECT "value" FROM "state" WHERE "id" = @id`);

    // Create the update transaction
    return (this.#update = db.transaction((rows: Action[]) => {
      const updates = rows.filter(isUpdate);
      const deletes = rows.filter(isDelete);

      const ids = uniq([...updates, ...deletes].map(row => row.id));

      for (const id of ids) del.run({ id });

      for (const row of updates) {
        const { oid, id, key, value } = row;
        const binkey = sortKey(row.key);
        ins.run({ binkey, oid, id, key: toJSON(key), value: toJSON(value) });
      }

      // Highest oid we've seen? They're in order
      // so it's the last one.
      this.#setState.run({ id: "oid", value: last(rows).oid });
    }));
  }

  private async indexDocument(rec: SSRecord) {
    if (rec.deleted) {
      this.#queue.push({ verb: "delete", oid: rec.oid, id: rec.id });
    } else {
      this.#focus = rec;
      await Promise.resolve(this.#mapFn(JSON.parse(rec.doc)));
      this.#focus = null;
      this.#queue.push({ verb: "mark", oid: rec.oid });
    }
    if (this.#queue.length >= queueMax) this.flush();
  }

  private flush() {
    if (this.#queue.length === 0) return;
    this.#update(this.#queue);
    this.#queue = [];
  }

  get highWaterMark() {
    const rec = this.#getState.get({ id: "oid" });
    return rec?.value ?? 0;
  }

  async update() {
    const hwm = this.highWaterMark;
    for (const rec of this.store.since(hwm)) await this.indexDocument(rec);
    this.flush();
  }
}
