import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

import { uniq } from "lodash";
import Database from "better-sqlite3";

import { SSDatabase } from "./database";
import { SSDocument, SSRecord, SSFocus } from "./types";
import { sortKey, KeyType, initCollation } from "../collation";

const chunkSize = 100;

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
const isMark = (action: Action): action is Mark => action.verb === "mark";

interface ViewRow {
  oid: number;
  id: string;
  key: KeyType;
  value: any;
}

export class SSView {
  store: SSDatabase;
  #viewDir: string;
  #dbDir: string;
  #db: Database.Database;

  #mapFn: (doc: SSDocument) => void;

  // Context for #mapFn
  #focus: SSFocus = null;

  // Insert queue
  #queue: Action[] = [];

  #update: Database.Transaction = null;
  #getState: Database.Statement = null;
  #setState: Database.Statement = null;

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
    await initCollation();

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
    const context = {
      emit: (key: any, value: any) => {
        const { oid, id } = this.#focus;
        this.#queue.push({ verb: "update", oid, id, key, value });
      },
      toJSON: JSON.stringify,
      exports: null
    };
    vm.createContext(context);
    vm.runInContext(code, context);

    this.#mapFn = context.exports as (doc: SSDocument) => void;
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
        ins.run({
          binkey: sortKey(row.key),
          oid: row.oid,
          id: row.id,
          key: JSON.stringify(row.key ?? null),
          value: JSON.stringify(row.value ?? null)
        });
      }

      // Highest oid we've seen?
      const oid = Math.max(...rows.map(r => r.oid));

      this.#setState.run({ id: "oid", value: oid });
    }));
  }

  indexDocument(rec: SSRecord) {
    this.#focus = rec;
    if (rec.deleted) {
      this.#queue.push({ verb: "delete", oid: rec.oid, id: rec.id });
    } else {
      this.#mapFn(JSON.parse(rec.doc));
      this.#queue.push({ verb: "mark", oid: rec.oid });
    }
    if (this.#queue.length >= chunkSize) this.flush();
  }

  flush() {
    if (this.#queue.length === 0) return;
    this.#update(this.#queue);
    this.#queue = [];
  }

  get highWaterMark() {
    const rec = this.#getState.get({ id: "oid" });
    return rec ? rec.value : 0;
  }

  async update() {
    const hwm = this.highWaterMark;
    let nice = 0;
    for (const rec of this.store.since(hwm)) {
      this.indexDocument(rec);
      if (++nice > 100) await Promise.resolve((nice = 0));
    }
    this.flush();
  }
}
