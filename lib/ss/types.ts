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
