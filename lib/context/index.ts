import path from "node:path";

import config from "config";

import { SSDatabase } from "../ss";

export class SSContext {
  static #singleton: SSContext = null;
  #dbs: Record<string, SSDatabase> = {};

  static get instance(): SSContext {
    return (this.#singleton = this.#singleton || new SSContext());
  }

  async database(name: string): Promise<SSDatabase> {
    return (this.#dbs[name] =
      this.#dbs[name] ||
      (await SSDatabase.create(path.join(config.get("data"), name), {
        viewRoot: config.get("viewRoot")
      })));
  }
}
