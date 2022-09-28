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

async function main(store: string, viewRoot) {
  console.log(`View Update`);
  const maps = await fg(path.join(viewRoot, "**", "map.js"));
  const db = await SSDatabase.create(store, { viewRoot });
  for (const { view, design } of maps.sort().map(viewName)) {
    const v = await db.view(design, view);
    console.log(`Updating ${design}/${view} (latest: ${v.highWaterMark})`);
    await v.update();
  }
}

main(store, viewRoot).catch(e => {
  console.error(e);
  process.exit(1);
});
