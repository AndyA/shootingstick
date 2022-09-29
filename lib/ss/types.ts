export interface SSFreeDocument {
  _id: string;
  _deleted?: boolean;
  [key: string]: any;
}

export interface SSDocument extends SSFreeDocument {
  _rev: string;
}

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

export type SSScalar = null | false | true | number | string;
export type SSKeyType = SSScalar | SSKeyType[] | { [key: string]: SSKeyType };

export interface SSViewConfig {
  conflicts: boolean;
  descending: boolean;
  endkey?: SSKeyType;
  endkey_docid?: string;
  group: boolean;
  group_level?: number;
  include_docs: boolean;
  attachments: boolean;
  inclusive_end: boolean;
  key?: SSKeyType;
  keys?: SSKeyType[];
  limit?: number;
  reduce?: boolean;
  skip: number;
  sorted: boolean;
  stable: boolean;
  stale?: "ok" | "update_after";
  startkey?: SSKeyType;
  startkey_docid?: string;
  update: boolean | "lazy";
  update_seq: boolean;
}

export type SSViewOptions = Partial<SSViewConfig>;
