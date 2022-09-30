import path from "node:path";
import fg from "fast-glob";

import { SSDatabase } from "../lib/ss";

const store = "tmp/ns";
const viewRoot = "couch";

const viewName = (file: string) => {
  const dir = path.dirname(file);
  const view = path.basename(dir);
  const design = path.basename(path.dirname(path.dirname(dir)));
  return { view, design };
};

async function update(db: SSDatabase, viewRoot: string) {
  console.log(`View Update`);
  const maps = await fg(path.join(viewRoot, "**", "map.js"));
  for (const { view, design } of maps.sort().map(viewName)) {
    const v = await db.getView(design, view);
    console.log(`Updating ${design}/${view} (latest: ${v.highWaterMark})`);
    await v.update();
  }
}

async function query(db: SSDatabase) {
  const res = await db.view("confidence", "confidence", {
    startkey: [1937, 12, 7, 0],
    endkey: [1937, 12, 7, 7, {}],
    include_docs: true,
    limit: 3
  });

  console.log(JSON.stringify(res, null, 2));
}

async function writeDoc(db: SSDatabase) {
  const [prev] = db.load(["test1"]);
  const doc = {
    _id: "test1",
    _rev: prev._rev,
    _deleted: true
    // kind: "test",
    // when: new Date().toISOString()
  };
  const res = db.bulk([doc]);
  console.log(res);
}

async function main(store: string, viewRoot: string) {
  const db = await SSDatabase.create(store, { viewRoot });
  await update(db, viewRoot);
  // await query(db);
  // await writeDoc(db);
}

main(store, viewRoot).catch(e => {
  console.error(e);
  process.exit(1);
});
