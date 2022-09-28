import { PageAll } from "../lib/couchdb/pager";
import nano from "nano";
import { SSDatabase } from "../lib/ss";

const store = "tmp/ns";
const server = "http://chaise:sofa@stilt:5984";
const database = "news-scripts-2";

async function migrate(store: string, server: string, database: string) {
  const db = await SSDatabase.create(store);
  const couch = nano(server).use(database);

  const pager = new PageAll(couch, {
    page_size: 100,
    params: { include_docs: true }
  });

  let count = 0;
  while (true) {
    const objs = (await pager.nextPage()).rows;
    if (!objs.length) break;

    const docs = objs
      .map((r: any) => r.doc)
      .filter((d: any) => d?.kind === "script");

    if (!docs.length) continue;

    count += docs.length;

    db.insert(docs);
    console.error(`Loaded ${count}`);
  }
}

migrate(store, server, database).catch(e => {
  console.error(e);
  process.exit(1);
});
