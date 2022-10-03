import express, { Request, Response } from "express";
import { version } from "../package.json";
import config from "config";
import { SSContext } from "../lib/context";

const port = config.get("port");

const app = express();
const ctx = SSContext.instance;

const writeLine = (res: Response, line: string) =>
  new Promise(resolve => res.write(`${line}\r\n`, "utf8", resolve));

async function streamRows(res: Response, iter: Generator, total: number) {
  const head = JSON.stringify({ total, rows: [] });
  res.on("close", () => iter.return(undefined));
  await writeLine(res, head.slice(0, -2));
  let prev = null;
  for (const row of iter) {
    if (prev !== null) await writeLine(res, `${prev},`);
    prev = JSON.stringify(row);
  }
  if (prev !== null) await writeLine(res, prev);
  await writeLine(res, head.slice(-2));
  res.end();
}

app.get(
  "/:database/_design/:ddoc/_view/:view",
  async (req: Request, res: Response) => {
    const { database, ddoc, view } = req.params;
    const store = await ctx.database(database);
    const v = await store.view(ddoc, view);
    const iter = v.query({ limit: 1000 });
    await streamRows(res, iter, v.total);
  }
);

app.get("/", (req: Request, res: Response) =>
  res.json({ couchdb: "Welcome", version, features: [] })
);

app.listen(port, () => console.log(`Listening on ${port}`));
