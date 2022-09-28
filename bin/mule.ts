import Database from "better-sqlite3";

const queue = [
  { key: [1923, 12, 11] },
  { key: [1923] },
  { key: [1948, 1, 3.1, "leak"] }
];

function colType(col: any) {
  if (col === null) return "NULL";
  if (typeof col === "number") {
    if (col === Math.floor(col)) return "INTEGER";
    return "REAL";
  }
  if (typeof col === "string") return "TEXT";
  throw new Error(`Bad column`);
}

function indexShape(rows: typeof queue) {
  const survey = [];
  for (const row of rows) {
    row.key.map(colType).map((type, i) => {
      const slot = (survey[i] = survey[i] || {});
      slot[type] = (slot[type] || 0) + 1;
    });
  }

  return survey
    .map(info =>
      info.REAL && info.INTEGER ? { REAL: info.REAL + info.INTEGER } : info
    )
    .map(info => {
      const types = Object.keys(info);
      if (types.length > 1) throw new Error(`Mixed types: ${types.join(", ")}`);
      const type = types[0];
      return { type, optional: info[type] < rows.length };
    });
}

function tableShape(info: any[]) {
  return info.flatMap((col, i) => {
    if (col.name !== `k${i}`) return [];
    const { type, notnull } = col;
    return [{ type, optional: !notnull }];
  });
}

const db = new Database("tmp/foo.db");
const res = db.prepare(`PRAGMA table_info("view")`).all();
if (res.length) {
  console.log(tableShape(res));
  const res2 = db
    .prepare(`SELECT * FROM "view" WHERE "id" = @id`)
    .get({ id: "foo" });
  console.log(res2);
} else {
  const shape = indexShape(queue);
  const frag = shape
    .map(
      ({ type, optional }, i) => `"k${i}" ${type}${optional ? "" : " NOT NULL"}`
    )
    .join(", ");
  const sql =
    `CREATE TABLE "view" (` +
    `  ${frag}, ` +
    `  "oid" INTEGER NOT NULL,` +
    `  "id" TEXT NOT NULL,` +
    `  "value" TEXT NOT NULL` +
    `)`;

  db.prepare(sql).run();

  const indexes = shape.map((_, i) => `k${i}`).concat("oid", "id");
  for (const col of indexes)
    db.prepare(`CREATE INDEX "view-${col}" ON "view"("${col}")`).run();
}
