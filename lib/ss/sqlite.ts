import Database from "better-sqlite3";

export class Sqlite extends Database {
  #statementCache: Record<string, Database.Statement> = {};

  learn(sql: string): Database.Statement {
    return (this.#statementCache[sql] =
      this.#statementCache[sql] || this.prepare(sql));
  }
}
