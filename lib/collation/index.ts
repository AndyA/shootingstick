import { Buffer } from "node:buffer";
import * as uca from "unicode-collation-algorithm2";
import type { SSKeyType } from "../ss/types";

enum CodingMark {
  ArrayEnd = 0x0001,
  ObjectEnd,
  Null,
  False,
  True,
  NegativeNumber,
  PositiveNumber,
  String,
  ArrayStart,
  ObjectStart,
  Escape = 0x000f
}

function escapedSize(buf: Buffer) {
  let size = buf.length;
  for (let i = 0; i < buf.length; i += 2) {
    const w = buf.readUInt16BE(i);
    if (w <= CodingMark.Escape) size += 2;
  }

  return size;
}

const flags = uca.PRIMARY | uca.SECONDARY | uca.TERTIARY | uca.QUATERNARY;
const ucaKey = (s: string) => uca.sortKey(s, flags);

// Currently quite expensive...
export function sortKey(obj: SSKeyType) {
  const cache: Record<string, Buffer> = {};

  const getSize = (obj: SSKeyType) => {
    if (obj === true || obj === false || obj === null) return 2;
    if (typeof obj === "number") return 10;
    // The encoded size of an array is the size of its elements
    // plus 4 for the containing CodeMarks
    if (Array.isArray(obj)) return obj.reduce((a, b) => a + getSize(b), 4);
    // The encoded size of an object is the same as the size of the
    // equivalent entries array.
    if (typeof obj === "object") return getSize(Object.entries(obj));
    // Strings need to be escaped
    if (typeof obj === "string")
      return escapedSize((cache[obj] = cache[obj] || ucaKey(obj))) + 2;
    throw new Error(`Bad thing`);
  };

  const size = getSize(obj);
  const buf = Buffer.alloc(size);
  let pos = 0;

  const putWord = (w: number) => {
    buf.writeUInt16BE(w, pos);
    pos += 2;
  };

  const putDouble = (w: number) => {
    buf.writeDoubleBE(w, pos);
    pos += 8;
  };

  const negate = (pos: number, end: number) => {
    while (pos < end) {
      buf.writeUInt16BE(buf.readUInt16BE(pos) ^ 0xffff, pos);
      pos += 2;
    }
  };

  const putArray = (ar: SSKeyType[], start: CodingMark, end: CodingMark) => {
    putWord(start);
    for (const obj of ar) encodeKey(obj);
    putWord(end);
  };

  const putString = (str: Buffer) => {
    putWord(CodingMark.String);
    for (let pos = 0; pos < str.length; pos += 2) {
      const w = str.readUInt16BE(pos);
      if (w <= CodingMark.Escape) putWord(CodingMark.Escape);
      putWord(w);
    }
  };

  const encodeKey = (obj: SSKeyType) => {
    if (obj === null) putWord(CodingMark.Null);
    else if (obj === false) putWord(CodingMark.False);
    else if (obj === true) putWord(CodingMark.True);
    else if (typeof obj === "number") {
      if (obj < 0) {
        putWord(CodingMark.NegativeNumber);
        const prev = pos;
        putDouble(-obj);
        negate(prev, pos);
      } else {
        putWord(CodingMark.PositiveNumber);
        putDouble(Math.abs(obj)); // -0
      }
    } else if (Array.isArray(obj)) {
      putArray(obj, CodingMark.ArrayStart, CodingMark.ArrayEnd);
    } else if (typeof obj === "object") {
      const ar = Object.entries(obj);
      putArray(ar, CodingMark.ObjectStart, CodingMark.ObjectEnd);
    } else if (typeof obj === "string") {
      putString(cache[obj]);
    } else {
      throw new Error(`Bad thing`);
    }
  };

  encodeKey(obj);
  if (pos !== size) throw new Error(`pos=${pos}, size=${size}`);
  return buf;
}

let initDone = false;

export async function initCollation() {
  if (!initDone) {
    await uca.init();
    initDone = true;
  }
}
