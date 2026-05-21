import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const auditLogger = {
    warn: vi.fn()
  };

  return {
    auditLogger,
    prisma: {
      $transaction: vi.fn(),
      auditLog: {
        create: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn()
      }
    },
    logger: {
      child: vi.fn(() => auditLogger)
    }
  };
});

vi.mock('../src/config/prisma', () => ({
  default: mocks.prisma
}));

vi.mock('../src/lib/logger', () => ({
  logger: mocks.logger
}));

import { listAuditLogs, logEvent, logEventFromRequest } from '../src/services/audit.service';

const auditLogger = mocks.logger.child();

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('audit.service', () => {
  beforeEach(() => {
    mocks.prisma.$transaction.mockImplementation(async (input: unknown[]) => Promise.all(input));
    mocks.prisma.auditLog.create.mockResolvedValue({});
    mocks.prisma.auditLog.count.mockResolvedValue(1);
    mocks.prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        userId: 7,
        eventType: 'AUTH_LOGIN_SUCCESS',
        entityType: 'User',
        entityId: '7',
        ip: '127.0.0.1',
        userAgent: 'Vitest',
        metadata: { ok: true },
        success: true,
        createdAt: new Date('2026-05-21T10:00:00.000Z'),
        user: {
          id: 7,
          fullName: 'Ana Creator',
          username: 'ana',
          email: 'ana@test.local',
          role: 'USER'
        }
      }
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('writes normalized audit events without blocking the caller', async () => {
    logEvent({
      eventType: 'AUTH_LOGIN_SUCCESS',
      userId: 7,
      entityType: ' User '.repeat(30),
      entityId: 123,
      ip: ' 127.0.0.1 ',
      userAgent: 'Vitest Agent'.repeat(40),
      metadata: { source: 'spec' }
    });

    await flushMicrotasks();

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 7,
        eventType: 'AUTH_LOGIN_SUCCESS',
        entityType: expect.stringMatching(/^User/),
        entityId: '123',
        ip: '127.0.0.1',
        userAgent: expect.stringContaining('Vitest Agent'),
        metadata: { source: 'spec' },
        success: true
      })
    });
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data.entityType).toHaveLength(80);
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data.userAgent).toHaveLength(255);
  });

  it('logs write failures instead of throwing from fire-and-forget audit events', async () => {
    mocks.prisma.auditLog.create.mockRejectedValue(new Error('database down'));

    expect(() => {
      logEvent({ eventType: 'AUTH_LOGIN_FAIL', success: false });
    }).not.toThrow();

    await flushMicrotasks();

    expect(auditLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'audit_log_write_failed',
        auditEventType: 'AUTH_LOGIN_FAIL',
        errorMessage: 'database down'
      }),
      'audit log write failed'
    );
  });

  it('uses request metadata and explicit input userId precedence', async () => {
    logEventFromRequest(
      {
        userId: 7,
        ip: '10.0.0.1',
        headers: {
          'user-agent': 'Vitest Request'
        }
      } as never,
      {
        eventType: 'ADMIN_RESET_2FA',
        userId: 9,
        entityType: 'User',
        entityId: 11
      }
    );

    await flushMicrotasks();

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 9,
        ip: '10.0.0.1',
        userAgent: 'Vitest Request'
      })
    });
  });

  it('lists audit logs with filters, pagination and serialized dates', async () => {
    const startDate = new Date('2026-05-01T00:00:00.000Z');
    const endDate = new Date('2026-05-21T23:59:59.000Z');

    const result = await listAuditLogs({
      eventType: 'AUTH_LOGIN_SUCCESS',
      userId: 7,
      startDate,
      endDate,
      pagination: { page: 2, limit: 10 }
    });

    expect(result.meta).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
    expect(result.items[0]).toMatchObject({
      id: 'audit-1',
      createdAt: '2026-05-21T10:00:00.000Z',
      user: {
        username: 'ana'
      }
    });
    expect(mocks.prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventType: 'AUTH_LOGIN_SUCCESS',
          userId: 7,
          createdAt: { gte: startDate, lte: endDate }
        },
        skip: 10,
        take: 10
      })
    );
  });
});
