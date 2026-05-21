const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

interface PaginationInput {
  page?: number;
  limit?: number;
}

interface Pagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PaginatedResult<T> {
  data: T[];
  items: T[];
  meta: PaginationMeta;
}

const normalizePagination = ({ page, limit }: PaginationInput = {}): Pagination => {
  const normalizedPage = Number.isInteger(page) && page && page > 0 ? page : DEFAULT_PAGE;
  const normalizedLimit =
    Number.isInteger(limit) && limit && limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT;

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip: (normalizedPage - 1) * normalizedLimit,
    take: normalizedLimit
  };
};

const buildPaginationMeta = (
  total: number,
  pagination: Pick<Pagination, 'page' | 'limit'>
): PaginationMeta => ({
  page: pagination.page,
  limit: pagination.limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / pagination.limit))
});

const toPaginatedResult = <T>(
  items: T[],
  total: number,
  pagination: Pick<Pagination, 'page' | 'limit'>
): PaginatedResult<T> => ({
  data: items,
  items,
  meta: buildPaginationMeta(total, pagination)
});

export {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  buildPaginationMeta,
  normalizePagination,
  toPaginatedResult
};
export type { PaginatedResult, Pagination, PaginationInput, PaginationMeta };
