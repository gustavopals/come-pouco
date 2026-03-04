import { Prisma } from '@prisma/client';

import prisma from '../config/prisma';

type ApiUsageMode = 'MOCK' | 'REAL';

interface ApiUsageFilters {
  companyId?: number;
  userId?: number;
  startDate?: Date;
  endDate?: Date;
  mode?: ApiUsageMode;
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

const buildWhereFilter = ({ companyId, userId, startDate, endDate, mode }: ApiUsageFilters): Prisma.ApiRequestLogWhereInput => {
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

const getApiUsageSummary = async (filters: ApiUsageFilters): Promise<ApiUsageSummary> => {
  const totalGeralPromise = prisma.apiRequestLog.count({
    where: buildWhereFilter(filters)
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

  const [totalMock, totalReal, totalGeral] = await Promise.all([totalMockPromise, totalRealPromise, totalGeralPromise]);

  return {
    totalMock,
    totalReal,
    totalGeral
  };
};

const deleteMockUsage = async ({ companyId, startDate, endDate }: DeleteMockFilters): Promise<number> => {
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
