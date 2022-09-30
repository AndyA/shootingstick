import { createHash } from "node:crypto";
import { zip } from "lodash";
import { SSDocument, SSFreeDocument } from "./types";

export const toJSON = (obj: any): string => JSON.stringify(obj ?? null);
export const sum = (list: number[]): number => list.reduce((a, b) => a + b, 0);

export const bindVars = (names: string[]): string =>
  names.map(n => `@${n}`).join(", ");

export const bindNames =
  (prefix: string) =>
  (keys: any[]): string[] =>
    keys.map((_, i) => `${prefix}${i}`);

export const bindObject = (names: string[]) => (values: any[]) =>
  Object.fromEntries(zip(names, values));

export function parseRev(rev: string) {
  const m = rev.match(/^(\d+)-[0-9a-f]+$/);
  if (m) return Number(m[1]);
}

export const objectHash = (obj: any): string =>
  createHash("sha256").update(JSON.stringify(obj)).digest("hex");

export function nextRev(doc: SSFreeDocument) {
  const { _rev, ...rest } = doc;
  const rev = _rev && typeof _rev === "string" ? parseRev(_rev) : 0;
  const hash = objectHash(rest);
  return `${rev + 1}-${hash}`;
}
