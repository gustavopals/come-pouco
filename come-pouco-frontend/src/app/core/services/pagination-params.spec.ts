import { of } from 'rxjs';
import { vi } from 'vitest';

import { PaginatedResponse } from '../models/pagination.model';
import { buildPaginationParams, collectPaginatedItems } from './pagination-params';

describe('pagination helpers', () => {
  it('monta HttpParams apenas com pagina e limite validos', () => {
    expect(buildPaginationParams().toString()).toBe('');
    expect(buildPaginationParams({ page: 2, limit: 50 }).toString()).toBe('page=2&limit=50');
  });

  it('coleta todas as paginas ate totalPages', () => {
    const requestPage = vi.fn((page: number, limit: number) =>
      of({
        items: [`item-${page}`],
        meta: {
          page,
          limit,
          total: 2,
          totalPages: 2,
        },
      } satisfies PaginatedResponse<string>),
    );
    let received: string[] = [];

    collectPaginatedItems(requestPage, (response) => response.items, 10).subscribe((items) => {
      received = items;
    });

    expect(requestPage).toHaveBeenCalledTimes(2);
    expect(requestPage).toHaveBeenNthCalledWith(1, 1, 10);
    expect(requestPage).toHaveBeenNthCalledWith(2, 2, 10);
    expect(received).toEqual(['item-1', 'item-2']);
  });
});
