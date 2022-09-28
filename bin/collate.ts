import { sortKey, KeyType, initCollation } from "../lib/collation";

function sortWithKey<T>(values: T[], sortKey: (value: T) => Buffer) {
  const data = values.map(value => ({ value, key: sortKey(value) }));
  data.sort((a, b) => a.key.compare(b.key));
  return data.map(({ value }) => value);
}

function withSortKey(values: KeyType[]) {
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
  1 << 50,
  -1000000,
  -12,
  -3,
  3.001,
  1 / 1000,
  5,
  4,
  3.1,
  -0.0001,
  3.01,
  3.00001
];

const things = [
  ["A", "B", "C"],
  { A: 3, B: 12 },
  "Hello",
  ["A"],
  ...strings,
  { A: 3, B: 12, C: 0 },
  ...numbers,
  { A: 13, B: 9 },
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
