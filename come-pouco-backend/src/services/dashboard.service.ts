import { ConversionStatus, Prisma } from '@prisma/client';

import prisma from '../config/prisma';

type DashboardRange = '7d' | '30d' | '90d';
type TimelineBucket = 'day' | 'hour';
type DashboardScope = {
  userId: number;
  userRole: string;
  companyId: number | null;
  companyRole: string | null;
};

interface ConversionDashboardFilters {
  range?: DashboardRange;
  employeeId?: number;
}

interface ConversionTopProductsFilters extends ConversionDashboardFilters {
  limit?: number;
}

interface ConversionTimelineFilters extends ConversionDashboardFilters {
  bucket?: TimelineBucket;
}

type ConversionTimelineItem = {
  bucketStart: string;
  total: number;
  success: number;
  fallback: number;
  error: number;
  botDetected: number;
};

const RANGE_DAYS: Record<DashboardRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90
};

const ZERO_PRODUCTION_SUMMARY = {
  todayCount: 0,
  avgLast7Days: 0,
  maxLast7Days: 0,
  minLast7Days: 0
};

export const getProductionSummary = async (companyId: number | null, userRole: string) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const where: Prisma.AffiliateLinkWhereInput = {};
  if (userRole !== 'ADMIN') {
    if (!companyId) {
      return ZERO_PRODUCTION_SUMMARY;
    }

    where.companyId = companyId;
  }

  const todayCount = await prisma.affiliateLink.count({
    where: {
      ...where,
      createdAt: {
        gte: todayStart,
        lte: todayEnd
      }
    }
  });

  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const last7DaysLinks = await prisma.affiliateLink.findMany({
    where: {
      ...where,
      createdAt: {
        gte: sevenDaysAgo
      }
    },
    select: {
      createdAt: true
    }
  });

  const dailyCounts: Record<string, number> = {};
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(todayStart);
    day.setDate(day.getDate() - i);
    const dateKey = toLocalDateKey(day);
    dailyCounts[dateKey] = 0;
  }

  last7DaysLinks.forEach((link) => {
    const dateKey = toLocalDateKey(link.createdAt);
    if (dailyCounts[dateKey] !== undefined) {
      dailyCounts[dateKey] += 1;
    }
  });

  const counts = Object.values(dailyCounts);
  const sum = counts.reduce((acc, count) => acc + count, 0);
  const avg = sum / 7;

  return {
    todayCount,
    avgLast7Days: Number(avg.toFixed(2)),
    maxLast7Days: Math.max(...counts),
    minLast7Days: Math.min(...counts)
  };
};

const getConversionSummary = async (
  scope: DashboardScope,
  filters: ConversionDashboardFilters = {}
) => {
  const context = await buildConversionContext(scope, filters);
  const [statusCounts, landingState] = await Promise.all([
    prisma.conversion.groupBy({
      by: ['status'],
      where: context.where,
      _count: {
        _all: true
      }
    }),
    getLandingState(context.companyId)
  ]);

  const successCount = countStatus(statusCounts, 'SUCCESS');
  const fallbackCount = countStatus(statusCounts, 'FALLBACK');
  const errorCount = countStatus(statusCounts, 'ERROR');
  const botDetectedCount = countStatus(statusCounts, 'BOT_DETECTED');
  const total = successCount + fallbackCount + errorCount + botDetectedCount;

  return {
    range: context.range,
    from: context.from.toISOString(),
    to: context.to.toISOString(),
    total,
    successCount,
    fallbackCount,
    errorCount,
    botDetectedCount,
    successRate: toRate(successCount, total),
    fallbackRate: toRate(fallbackCount, total),
    averageDaily: Number((total / context.rangeDays).toFixed(2)),
    landingActive: landingState.active,
    activeLandingCount: landingState.activeCount
  };
};

const getConversionTopProducts = async (
  scope: DashboardScope,
  filters: ConversionTopProductsFilters = {}
) => {
  const context = await buildConversionContext(scope, filters);
  const limit = filters.limit ?? 10;

  const rows = await prisma.conversion.groupBy({
    by: ['itemId', 'shopId', 'productName'],
    where: {
      ...context.where,
      itemId: {
        not: null
      }
    },
    _count: {
      _all: true
    },
    orderBy: {
      _count: {
        itemId: 'desc'
      }
    },
    take: limit
  });

  return {
    range: context.range,
    items: rows.map((row) => ({
      itemId: row.itemId!,
      shopId: row.shopId,
      productName: row.productName,
      total: row._count._all
    }))
  };
};

const getConversionsByEmployee = async (
  scope: DashboardScope,
  filters: ConversionDashboardFilters = {}
) => {
  const context = await buildConversionContext(scope, filters);
  const rows = await prisma.conversion.groupBy({
    by: ['employeeId', 'status'],
    where: context.where,
    _count: {
      _all: true
    }
  });

  const employeeIds = [
    ...new Set(rows.map((row) => row.employeeId).filter((id): id is number => id !== null))
  ];
  const employees = employeeIds.length
    ? await prisma.user.findMany({
        where: {
          id: {
            in: employeeIds
          }
        },
        select: {
          id: true,
          fullName: true,
          publicSlug: true
        }
      })
    : [];
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const grouped = new Map<
    number | null,
    { success: number; fallback: number; error: number; botDetected: number }
  >();

  rows.forEach((row) => {
    const current = grouped.get(row.employeeId) ?? {
      success: 0,
      fallback: 0,
      error: 0,
      botDetected: 0
    };

    incrementStatus(current, row.status, row._count._all);
    grouped.set(row.employeeId, current);
  });

  return {
    range: context.range,
    items: [...grouped.entries()]
      .map(([employeeId, counts]) => {
        const total = counts.success + counts.fallback + counts.error + counts.botDetected;
        const employee = employeeId ? employeeById.get(employeeId) : null;

        return {
          employeeId,
          employeeName: employee?.fullName ?? 'Direto',
          employeeSlug: employee?.publicSlug ?? 'direct',
          total,
          ...counts,
          successRate: toRate(counts.success, total),
          fallbackRate: toRate(counts.fallback, total)
        };
      })
      .sort((a, b) => b.total - a.total)
  };
};

const getConversionTimeline = async (
  scope: DashboardScope,
  filters: ConversionTimelineFilters = {}
) => {
  const context = await buildConversionContext(scope, filters);
  const bucket = filters.bucket ?? 'day';
  const buckets = buildTimelineBuckets(context.from, context.to, bucket);
  const rows = await prisma.conversion.findMany({
    where: context.where,
    select: {
      createdAt: true,
      status: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  rows.forEach((row) => {
    const key = toBucketKey(row.createdAt, bucket);
    const current = buckets.get(key);

    if (!current) {
      return;
    }

    incrementTimelineStatus(current, row.status);
  });

  return {
    range: context.range,
    bucket,
    items: [...buckets.values()]
  };
};

const buildConversionContext = async (
  scope: DashboardScope,
  filters: ConversionDashboardFilters
) => {
  const range = filters.range ?? '7d';
  const rangeDays = RANGE_DAYS[range];
  const to = new Date();
  const from = startOfUtcDay(addDays(to, -(rangeDays - 1)));
  const companyId = resolveDashboardCompanyId(scope);
  const employeeId = await resolveDashboardEmployeeId(scope, filters.employeeId, companyId);
  const where: Prisma.ConversionWhereInput = {
    createdAt: {
      gte: from,
      lte: to
    }
  };

  if (companyId !== null) {
    where.companyId = companyId;
  }

  if (employeeId !== null) {
    where.employeeId = employeeId;
  }

  return {
    range,
    rangeDays,
    from,
    to,
    where,
    companyId
  };
};

const resolveDashboardCompanyId = (scope: DashboardScope): number | null => {
  if (scope.userRole === 'ADMIN') {
    return null;
  }

  if ((scope.companyRole === 'OWNER' || scope.companyRole === 'EMPLOYEE') && scope.companyId) {
    return scope.companyId;
  }

  throw new Error('CONVERSIONS_DASHBOARD_FORBIDDEN');
};

const resolveDashboardEmployeeId = async (
  scope: DashboardScope,
  requestedEmployeeId: number | undefined,
  companyId: number | null
): Promise<number | null> => {
  if (scope.companyRole === 'EMPLOYEE') {
    return scope.userId;
  }

  if (!requestedEmployeeId) {
    return null;
  }

  if (companyId !== null) {
    await assertEmployeeBelongsToCompany(companyId, requestedEmployeeId);
  }

  return requestedEmployeeId;
};

const assertEmployeeBelongsToCompany = async (
  companyId: number,
  employeeId: number
): Promise<void> => {
  const exists = await prisma.user.findFirst({
    where: {
      id: employeeId,
      companyId
    },
    select: {
      id: true
    }
  });

  if (!exists) {
    throw new Error('CONVERSIONS_EMPLOYEE_NOT_FOUND');
  }
};

const getLandingState = async (
  companyId: number | null
): Promise<{ active: boolean; activeCount: number }> => {
  const where: Prisma.LandingConfigWhereInput =
    companyId === null ? { isActive: true } : { companyId, isActive: true };
  const activeCount = await prisma.landingConfig.count({ where });

  return {
    active: activeCount > 0,
    activeCount
  };
};

const countStatus = (
  rows: Array<{ status: ConversionStatus; _count: { _all: number } }>,
  status: ConversionStatus
): number => rows.find((row) => row.status === status)?._count._all ?? 0;

const incrementStatus = (
  target: { success: number; fallback: number; error: number; botDetected: number },
  status: ConversionStatus,
  value: number
): void => {
  if (status === 'SUCCESS') {
    target.success += value;
  } else if (status === 'FALLBACK') {
    target.fallback += value;
  } else if (status === 'ERROR') {
    target.error += value;
  } else if (status === 'BOT_DETECTED') {
    target.botDetected += value;
  }
};

const incrementTimelineStatus = (
  target: ConversionTimelineItem,
  status: ConversionStatus
): void => {
  target.total += 1;

  if (status === 'SUCCESS') {
    target.success += 1;
  } else if (status === 'FALLBACK') {
    target.fallback += 1;
  } else if (status === 'ERROR') {
    target.error += 1;
  } else if (status === 'BOT_DETECTED') {
    target.botDetected += 1;
  }
};

const buildTimelineBuckets = (
  from: Date,
  to: Date,
  bucket: TimelineBucket
): Map<string, ConversionTimelineItem> => {
  const buckets = new Map<string, ConversionTimelineItem>();
  const cursor = bucket === 'day' ? startOfUtcDay(from) : startOfUtcHour(from);
  const end = bucket === 'day' ? startOfUtcDay(to) : startOfUtcHour(to);

  while (cursor.getTime() <= end.getTime()) {
    const key = toBucketKey(cursor, bucket);
    buckets.set(key, {
      bucketStart: key,
      total: 0,
      success: 0,
      fallback: 0,
      error: 0,
      botDetected: 0
    });

    if (bucket === 'day') {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    } else {
      cursor.setUTCHours(cursor.getUTCHours() + 1);
    }
  }

  return buckets;
};

const toBucketKey = (date: Date, bucket: TimelineBucket): string => {
  if (bucket === 'day') {
    return `${date.toISOString().slice(0, 10)}T00:00:00.000Z`;
  }

  return `${date.toISOString().slice(0, 13)}:00:00.000Z`;
};

const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const startOfUtcHour = (date: Date): Date =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours())
  );

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const toLocalDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const toRate = (value: number, total: number): number =>
  total ? Number(((value / total) * 100).toFixed(2)) : 0;

export {
  getConversionSummary,
  getConversionTimeline,
  getConversionTopProducts,
  getConversionsByEmployee
};
export type {
  ConversionDashboardFilters,
  ConversionTimelineFilters,
  ConversionTopProductsFilters,
  DashboardScope
};
