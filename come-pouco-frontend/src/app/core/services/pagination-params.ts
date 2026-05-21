import { HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';

import { PaginatedResponse, PaginationParams } from '../models/pagination.model';

export const buildPaginationParams = (pagination?: PaginationParams): HttpParams => {
  let params = new HttpParams();

  if (pagination?.page) {
    params = params.set('page', String(pagination.page));
  }

  if (pagination?.limit) {
    params = params.set('limit', String(pagination.limit));
  }

  return params;
};

export const collectPaginatedItems = <TItem, TResponse extends PaginatedResponse<TItem>>(
  requestPage: (page: number, limit: number) => Observable<TResponse>,
  getItems: (response: TResponse) => TItem[],
  limit = 100,
): Observable<TItem[]> =>
  requestPage(1, limit).pipe(
    expand((response) => {
      const meta = response.meta;

      if (!meta || meta.page >= meta.totalPages) {
        return EMPTY;
      }

      return requestPage(meta.page + 1, meta.limit || limit);
    }),
    map((response) => getItems(response)),
    reduce((allItems, items) => allItems.concat(items), [] as TItem[]),
  );
