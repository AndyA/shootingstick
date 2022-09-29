import { zip } from "lodash";

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
