export type SSScalar = null | false | true | number | string;
export type SSObject = SSScalar | SSObject[] | { [key: string]: SSObject };

export interface SSFreeDocument {
  _id: string;
  _deleted?: boolean;
  [key: string]: SSObject;
}

export interface SSDocument extends SSFreeDocument {
  _rev: string;
}

export const isSSDocument = (doc: SSFreeDocument): doc is SSDocument =>
  "_rev" in doc;

export interface SSFocus {
  oid: number;
  id: string;
}

export interface SSRecord extends SSFocus {
  ts: number;
  rev: string;
  deleted: number;
  doc: string;
}

export interface SSViewConfig {
  conflicts: boolean;
  descending: boolean;
  endkey?: SSObject;
  endkey_docid?: string;
  group: boolean;
  group_level?: number;
  include_docs: boolean;
  attachments: boolean;
  inclusive_end: boolean;
  key?: SSObject;
  keys?: SSObject[];
  limit?: number;
  reduce?: boolean;
  skip: number;
  sorted: boolean;
  stable: boolean;
  stale?: "ok" | "update_after";
  startkey?: SSObject;
  startkey_docid?: string;
  update: boolean | "lazy";
  update_seq: boolean;
}

export type SSViewOptions = Partial<SSViewConfig>;

export interface SSViewRow {
  id: string;
  key: SSObject;
  value: SSObject;
  doc?: SSObject;
}

// export interface SSViewResult {
//   rows: SSViewRow[];
// }

export interface SSBulkRowOK {
  id: string;
  ok: true;
  rev: string;
}

export interface SSBulkRowError {
  id: string;
  error: string;
  reason: string;
}

export type SSBulkRow = SSBulkRowOK | SSBulkRowError;

export const isSSBulkRowOK = (row: SSBulkRow): row is SSBulkRowOK =>
  "ok" in row;

export const isSSBulkRowError = (row: SSBulkRow): row is SSBulkRowError =>
  "error" in row;

export type SSBulkResult = SSBulkRow[];
