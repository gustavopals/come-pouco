import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    conversion: {
      groupBy: vi.fn(),
      findMany: vi.fn()
    },
    landingConfig: {
      count: vi.fn()
    },
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

vi.mock('../src/config/prisma', () => ({
  default: mocks.prisma
}));

import { getConversionSummary, type DashboardScope } from '../src/services/dashboard.service';

const ownerScope: DashboardScope = {
  userId: 2,
  userRole: 'USER',
  companyId: 10,
  companyRole: 'OWNER'
};

const employeeScope: DashboardScope = {
  userId: 7,
  userRole: 'USER',
  companyId: 10,
  companyRole: 'EMPLOYEE'
};

describe('dashboard.service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T12:00:00.000Z'));
    mocks.prisma.conversion.groupBy.mockResolvedValue([
      { status: 'SUCCESS', _count: { _all: 2 } },
      { status: 'FALLBACK', _count: { _all: 1 } }
    ]);
    mocks.prisma.landingConfig.count.mockResolvedValue(1);
    mocks.prisma.user.findFirst.mockResolvedValue({ id: 7 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('filters conversion dashboard by the current employee for EMPLOYEE users', async () => {
    const summary = await getConversionSummary(employeeScope, { range: '7d', employeeId: 99 });

    expect(summary.total).toBe(3);
    expect(mocks.prisma.user.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.conversion.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 10,
          employeeId: 7
        })
      })
    );
  });

  it('allows OWNER users to filter conversions by company employee', async () => {
    await getConversionSummary(ownerScope, { range: '30d', employeeId: 7 });

    expect(mocks.prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 7,
        companyId: 10
      },
      select: {
        id: true
      }
    });
    expect(mocks.prisma.conversion.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 10,
          employeeId: 7
        })
      })
    );
  });

  it('rejects EMPLOYEE users without company context', async () => {
    await expect(
      getConversionSummary(
        {
          ...employeeScope,
          companyId: null
        },
        { range: '7d' }
      )
    ).rejects.toThrow('CONVERSIONS_DASHBOARD_FORBIDDEN');

    expect(mocks.prisma.conversion.groupBy).not.toHaveBeenCalled();
  });
});
