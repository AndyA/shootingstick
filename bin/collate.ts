import { sortKey, initCollation } from "../lib/collation";
import type { SSKeyType } from "../lib/ss/types";

function sortWithKey<T>(values: T[], sortKey: (value: T) => Buffer) {
  const data = values.map(value => ({ value, key: sortKey(value) }));
  data.sort((a, b) => a.key.compare(b.key));
  return data.map(({ value }) => value);
}

function withSortKey(values: SSKeyType[]) {
  const res = sortWithKey(values, sortKey);
  for (const row of res) console.log(JSON.stringify(row));
}

const strings = [
  "Sam",
  "Smoo",
  "Andy",
  "andy",
  "Andrew",
  "andover",
  "123",
  "~"
];

const numbers = [
  100,
  0.00001,
  3.0001,
  0,
  -1000000,
  -12,
  -3,
  3.001,
  1 / 1000,
  5,
  4,
  3.1,
  -0.0001,
  -0,
  3.01,
  3.00001,
  -1e38,
  1e38
];

const things = [
  ["A", "B", "C"],
  { A: 3, B: 12 },
  { A: 13, B: { count: 1 } },
  true,
  ["A", "B", { C: 1 }],
  { A: 13, B: [1, 2] },
  false,
  { A: 13, B: [1] },
  ["A", "B", { C: 0 }],
  "Hello",
  ["A"],
  ...strings,
  { A: 13, B: { count: 0 } },
  ["A", "B", { C: "Hi!" }],
  { A: 3, B: 12, C: 0 },
  false,
  ...numbers,
  { A: 13, B: 9 },
  null,
  [],
  { A: 13, B: 1 },
  []
];

async function main() {
  await initCollation();
  withSortKey(things);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
