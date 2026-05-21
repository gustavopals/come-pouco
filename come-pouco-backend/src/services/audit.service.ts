import { Prisma } from '@prisma/client';
import type { Request } from 'express';

import type { AuditEventType } from '../constants/audit-events';
import prisma from '../config/prisma';
import { logger } from '../lib/logger';
import { PaginationInput, normalizePagination, toPaginatedResult } from '../utils/pagination';

interface AuditEventInput {
  eventType: AuditEventType;
  userId?: number | null;
  entityType?: string | null;
  entityId?: string | number | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  success?: boolean;
}

const auditLogger = logger.child({ scope: 'audit' });

interface AuditLogQueryInput {
  eventType?: AuditEventType;
  userId?: number;
  startDate?: Date;
  endDate?: Date;
  pagination?: PaginationInput;
}

const trimToLength = (value: string | null | undefined, maxLength: number): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized.slice(0, maxLength) : null;
};

const normalizeEntityId = (value: string | number | null | undefined): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  return trimToLength(String(value), 120);
};

const writeAuditLog = async (input: AuditEventInput): Promise<void> => {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      eventType: input.eventType,
      entityType: trimToLength(input.entityType, 80),
      entityId: normalizeEntityId(input.entityId),
      ip: trimToLength(input.ip, 64),
      userAgent: trimToLength(input.userAgent, 255),
      metadata: input.metadata ?? undefined,
      success: input.success ?? true
    }
  });
};

const logAuditFailure = (error: unknown, eventType: AuditEventType): void => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  auditLogger.warn(
    {
      eventType: 'audit_log_write_failed',
      auditEventType: eventType,
      err: error instanceof Error ? error : undefined,
      errorMessage: message
    },
    'audit log write failed'
  );
};

const logEvent = (input: AuditEventInput): void => {
  void writeAuditLog(input).catch((error) => logAuditFailure(error, input.eventType));
};

const logEventFromRequest = (
  req: Request,
  input: Omit<AuditEventInput, 'ip' | 'userAgent'> & { userId?: number | null }
): void => {
  logEvent({
    ...input,
    userId: input.userId ?? req.userId ?? null,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null
  });
};

const auditUserSelect = {
  id: true,
  fullName: true,
  username: true,
  email: true,
  role: true
} satisfies Prisma.UserSelect;

const toAuditLogOutput = (
  log: Prisma.AuditLogGetPayload<{ include: { user: { select: typeof auditUserSelect } } }>
) => ({
  id: log.id,
  userId: log.userId,
  eventType: log.eventType,
  entityType: log.entityType,
  entityId: log.entityId,
  ip: log.ip,
  userAgent: log.userAgent,
  metadata: log.metadata,
  success: log.success,
  createdAt: log.createdAt.toISOString(),
  user: log.user
    ? {
        id: log.user.id,
        fullName: log.user.fullName,
        username: log.user.username,
        email: log.user.email,
        role: log.user.role
      }
    : null
});

const listAuditLogs = async ({
  eventType,
  userId,
  startDate,
  endDate,
  pagination: paginationInput
}: AuditLogQueryInput) => {
  const pagination = normalizePagination(paginationInput);
  const where: Prisma.AuditLogWhereInput = {
    eventType,
    userId,
    createdAt:
      startDate || endDate
        ? {
            gte: startDate,
            lte: endDate
          }
        : undefined
  };

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        user: { select: auditUserSelect }
      }
    })
  ]);

  const result = toPaginatedResult(logs.map(toAuditLogOutput), total, pagination);

  return {
    logs: result.items,
    data: result.data,
    items: result.items,
    meta: result.meta
  };
};

export { listAuditLogs, logEvent, logEventFromRequest };
export type { AuditEventInput, AuditLogQueryInput };
