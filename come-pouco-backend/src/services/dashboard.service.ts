import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

export const getProductionSummary = async (companyId: number | null, userRole: string) => {
  const now = new Date();
  
  // start of today in local server time, but usually we should consider UTC or user's timezone.
  // For simplicity as requested, we'll use server date.
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
  const where: Prisma.AffiliateLinkWhereInput = {};
  if (userRole !== 'ADMIN') {
    if (!companyId) return { todayCount: 0, avgLast7Days: 0, maxLast7Days: 0, minLast7Days: 0 };
    where.companyId = companyId;
  }

  const todayCount = await prisma.affiliateLink.count({
    where: {
      ...where,
      createdAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
  });

  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const last7DaysLinks = await prisma.affiliateLink.findMany({
    where: {
      ...where,
      createdAt: {
        gte: sevenDaysAgo,
      },
    },
    select: {
      createdAt: true,
    },
  });

  // Group by day
  const dailyCounts: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    // Use YYYY-MM-DD in local time to match grouping
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dailyCounts[dateStr] = 0;
  }

  last7DaysLinks.forEach((link) => {
    const d = link.createdAt;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (dailyCounts[dateStr] !== undefined) {
      dailyCounts[dateStr]++;
    }
  });

  const counts = Object.values(dailyCounts);
  const sum = counts.reduce((acc, count) => acc + count, 0);
  const avg = sum / 7;
  const max = Math.max(...counts);
  const min = Math.min(...counts);

  return {
    todayCount,
    avgLast7Days: parseFloat(avg.toFixed(2)),
    maxLast7Days: max,
    minLast7Days: min,
  };
};
