import { keyBy } from "lodash";
import { SSDatabase } from "./database";
import { SSDocument, SSViewRow } from "./types";
import { resolveViewReference } from "./view";

export class DocumentMerger {
  #store: SSDatabase;
  #cache: Record<string, SSDocument> = {};

  constructor(store: SSDatabase) {
    this.#store = store;
  }

  addDocuments(rows: SSViewRow[]): SSViewRow[] {
    if (rows.length === 0) return rows;
    const need = rows.map(resolveViewReference).filter(id => !this.#cache[id]);
    const cache = keyBy(this.#store.load(need), "_id");

    const out = rows.map(row => {
      const doc = (cache[row.id] = cache[row.id] || this.#cache[row.id]);
      if (!doc) throw new Error(`No doc found for ${row.id}`);
      return { ...row, doc };
    });

    // Roll round for next time. Because we lifted any documents
    // that we needed this time from the previous cache they will
    // also be available for re-use next time.
    this.#cache = cache;

    return out;
  }
}
