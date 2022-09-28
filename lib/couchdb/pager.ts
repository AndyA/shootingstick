"use strict";

import assert from "assert";
import {
  DocumentScope,
  DocumentListParams,
  DocumentListResponse,
  DocumentViewParams,
  DocumentViewResponse
} from "nano";

interface PageNext {
  startkey: string;
  startkey_docid: string;
}

interface PagerProps<D, P> {
  db: DocumentScope<D>;
  page_size: number;
  limit: number;
  next: PageNext | null;
  params: P;
}

type PagerOptions<D, P> = Partial<PagerProps<D, P>>;

type DocumentResponse<D, V = any> =
  | DocumentListResponse<D>
  | DocumentViewResponse<V, D>;

// Retrieve a (possibly huge) view in multiple pages using the approach here:
// http://docs.couchdb.org/en/2.2.0/ddocs/views/pagination.html#paging-alternate-method

export abstract class Pager<D, P, V = any> implements PagerProps<D, P> {
  db: DocumentScope<D>;
  page_size: number;
  limit: number;
  next: PageNext | null;
  params: P;

  constructor(db: DocumentScope<D>, opt: PagerOptions<D, P>) {
    const { page_size = 1000, limit, next = {}, params } = opt || {};
    assert(page_size > 0, "page_size must be > 0");
    Object.assign(this, { db, page_size, limit, next, params });
  }

  protected abstract getPage(params: P): Promise<DocumentResponse<D, V>>;

  async nextPage(): Promise<DocumentResponse<D, V>> {
    const chunk = this.page_size + 1;
    const limit = isNaN(this.limit) ? chunk : Math.min(this.limit, chunk);

    // Exhausted?
    if (this.next === null || limit === 0)
      return { rows: [], offset: 0, total_rows: 0 };

    // Build request params
    const params = Object.assign({}, this.params, this.next, { limit });

    // Only skip on the first request
    // @ts-ignore
    delete this.params.skip;

    const data = await this.getPage(params);
    const { rows } = data;

    if (rows.length === chunk) {
      // Got a full page + peek at next
      const { key, id } = rows.pop();

      // TODO From https://docs.couchdb.org/en/main/ddocs/views/pagination.html:
      //    "For pagination, we still don’t need endkey_docid, but startkey_docid
      //     is very handy. In addition to startkey and limit, you also use
      //     startkey_docid for pagination if, and only if, the extra row you
      //     fetch to find the next page has the same key as the current
      //     startkey."
      //
      // We're providing startkey_docid even if startkey differs. Is that wrong?

      this.next = { startkey: key, startkey_docid: id };
    } else {
      // Incomplete fetch so no more after this
      this.next = null;
    }

    // Count rows if we're tracking the limit
    if (!isNaN(this.limit)) this.limit -= rows.length;

    return data;
  }
}

const x: DocumentListParams = {
  include_docs: true
};

export class PageAll<D> extends Pager<D, DocumentListParams> {
  protected async getPage(
    params: DocumentListParams
  ): Promise<DocumentListResponse<D>> {
    return this.db.list(params);
  }
}

export class PageView<D, V = any> extends Pager<D, DocumentViewParams> {
  designName: string;
  viewName: string;

  constructor(
    db: DocumentScope<D>,
    designName: string,
    viewName: string,
    opt: PagerOptions<D, DocumentViewParams>
  ) {
    super(db, opt);
    this.designName = designName;
    this.viewName = viewName;
  }

  protected async getPage(
    params: DocumentViewParams
  ): Promise<DocumentViewResponse<V, D>> {
    return this.db.view(this.designName, this.viewName, params);
  }
}
