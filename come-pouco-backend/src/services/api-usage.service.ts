import { Prisma } from '@prisma/client';

import prisma from '../config/prisma';
import {
  PaginatedResult,
  PaginationInput,
  normalizePagination,
  toPaginatedResult
} from '../utils/pagination';

type ApiUsageMode = 'MOCK' | 'REAL';

interface ApiUsageFilters {
  companyId?: number;
  userId?: number;
  startDate?: Date;
  endDate?: Date;
  mode?: ApiUsageMode;
  pagination?: PaginationInput;
}

interface DeleteMockFilters {
  companyId?: number;
  startDate?: Date;
  endDate?: Date;
}

interface ApiUsageSummary {
  totalMock: number;
  totalReal: number;
  totalGeral: number;
  logs: ApiUsageLogOutput[];
  data: ApiUsageLogOutput[];
  items: ApiUsageLogOutput[];
  meta: PaginatedResult<ApiUsageLogOutput>['meta'];
}

interface ApiUsageLogOutput {
  id: string;
  companyId: number;
  userId: number;
  platformId: number;
  mode: ApiUsageMode;
  endpoint: string | null;
  success: boolean;
  createdAt: string;
}

const buildDateFilter = (startDate?: Date, endDate?: Date): Prisma.DateTimeFilter | undefined => {
  if (!startDate && !endDate) {
    return undefined;
  }

  const createdAt: Prisma.DateTimeFilter = {};

  if (startDate) {
    createdAt.gte = startDate;
  }

  if (endDate) {
    createdAt.lte = endDate;
  }

  return createdAt;
};

const buildWhereFilter = ({
  companyId,
  userId,
  startDate,
  endDate,
  mode
}: ApiUsageFilters): Prisma.ApiRequestLogWhereInput => {
  const where: Prisma.ApiRequestLogWhereInput = {};

  if (companyId) {
    where.companyId = companyId;
  }

  if (userId) {
    where.userId = userId;
  }

  const createdAt = buildDateFilter(startDate, endDate);
  if (createdAt) {
    where.createdAt = createdAt;
  }

  if (mode) {
    where.mode = mode;
  }

  return where;
};

const toApiUsageLogOutput = (log: {
  id: string;
  companyId: number;
  userId: number;
  platformId: number;
  mode: ApiUsageMode;
  endpoint: string | null;
  success: boolean;
  createdAt: Date;
}): ApiUsageLogOutput => ({
  id: log.id,
  companyId: log.companyId,
  userId: log.userId,
  platformId: log.platformId,
  mode: log.mode,
  endpoint: log.endpoint,
  success: log.success,
  createdAt: log.createdAt.toISOString()
});

const getApiUsageSummary = async (filters: ApiUsageFilters): Promise<ApiUsageSummary> => {
  const pagination = normalizePagination(filters.pagination);
  const where = buildWhereFilter(filters);
  const totalGeralPromise = prisma.apiRequestLog.count({
    where
  });

  const totalMockPromise =
    filters.mode === 'REAL'
      ? Promise.resolve(0)
      : prisma.apiRequestLog.count({
          where: buildWhereFilter({ ...filters, mode: 'MOCK' })
        });

  const totalRealPromise =
    filters.mode === 'MOCK'
      ? Promise.resolve(0)
      : prisma.apiRequestLog.count({
          where: buildWhereFilter({ ...filters, mode: 'REAL' })
        });

  const logsPromise = prisma.apiRequestLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: pagination.skip,
    take: pagination.take
  });

  const [totalMock, totalReal, totalGeral, logs] = await Promise.all([
    totalMockPromise,
    totalRealPromise,
    totalGeralPromise,
    logsPromise
  ]);
  const paginatedLogs = toPaginatedResult(logs.map(toApiUsageLogOutput), totalGeral, pagination);

  return {
    totalMock,
    totalReal,
    totalGeral,
    logs: paginatedLogs.items,
    data: paginatedLogs.data,
    items: paginatedLogs.items,
    meta: paginatedLogs.meta
  };
};

const deleteMockUsage = async ({
  companyId,
  startDate,
  endDate
}: DeleteMockFilters): Promise<number> => {
  const result = await prisma.apiRequestLog.deleteMany({
    where: buildWhereFilter({
      companyId,
      startDate,
      endDate,
      mode: 'MOCK'
    })
  });

  return result.count;
};

export { deleteMockUsage, getApiUsageSummary };
export type { ApiUsageFilters, ApiUsageMode, DeleteMockFilters };
