import { Prisma } from '@prisma/client';
import cron, { ScheduledTask } from 'node-cron';

import env from '../config/env';
import prisma from '../config/prisma';
import { logger } from '../lib/logger';

const HISTORY_CLEANUP_CRON = '0 3 * * *';
const cleanupLogger = logger.child({ scope: 'history-cleanup' });

let task: ScheduledTask | null = null;
let isRunning = false;

type RetentionTableName = 'affiliate_links' | 'api_request_logs' | 'audit_logs';

interface TableMetrics {
  rowCount: number;
  totalBytes: number;
}

interface CleanupStep {
  tableName: RetentionTableName;
  retentionDaysLabel: string;
  deleteExpiredRows: () => Promise<number>;
}

const toNumber = (value: number | string | bigint | null | undefined): number => Number(value ?? 0);

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

const getTableSql = (tableName: RetentionTableName): Prisma.Sql => {
  switch (tableName) {
    case 'affiliate_links':
      return Prisma.sql`"affiliate_links"`;
    case 'api_request_logs':
      return Prisma.sql`"api_request_logs"`;
    case 'audit_logs':
      return Prisma.sql`"audit_logs"`;
  }
};

const getTableMetrics = async (tableName: RetentionTableName): Promise<TableMetrics> => {
  const rows = await prisma.$queryRaw<
    Array<{ row_count: number | string | bigint; total_bytes: bigint | string }>
  >(Prisma.sql`
    SELECT
      COUNT(*)::bigint AS row_count,
      COALESCE(pg_total_relation_size(to_regclass(${`public.${tableName}`})), 0)::bigint AS total_bytes
    FROM ${getTableSql(tableName)};
  `);

  return {
    rowCount: toNumber(rows[0]?.row_count),
    totalBytes: toNumber(rows[0]?.total_bytes)
  };
};

const logTableMetrics = async (
  stage: 'antes' | 'depois',
  tableName: RetentionTableName
): Promise<void> => {
  const metrics = await getTableMetrics(tableName);
  cleanupLogger.info(
    {
      eventType: 'history_cleanup_table_metrics',
      stage,
      tableName,
      rowCount: metrics.rowCount,
      totalBytes: metrics.totalBytes,
      totalSize: formatBytes(metrics.totalBytes)
    },
    'history cleanup table metrics'
  );
};

const runDeleteCountQuery = async (query: Prisma.Sql): Promise<number> => {
  const rows = await prisma.$queryRaw<Array<{ deleted_count: number | string | bigint }>>(query);
  return toNumber(rows[0]?.deleted_count);
};

const deleteExpiredAffiliateLinks = async (): Promise<number> => {
  return runDeleteCountQuery(Prisma.sql`
    WITH deleted_rows AS (
      DELETE FROM "affiliate_links" al
      USING "companies" c
      WHERE al."company_id" = c."id"
        AND c."history_retention_days" IS NOT NULL
        AND c."history_retention_days" > 0
        AND al."created_at" < (NOW() - (c."history_retention_days" * INTERVAL '1 day'))
      RETURNING 1
    )
    SELECT COUNT(*)::bigint AS deleted_count
    FROM deleted_rows;
  `);
};

const deleteExpiredApiRequestLogs = async (): Promise<number> => {
  return runDeleteCountQuery(Prisma.sql`
    WITH deleted_rows AS (
      DELETE FROM "api_request_logs"
      WHERE "created_at" < (NOW() - (${env.apiRequestLogRetentionDays} * INTERVAL '1 day'))
      RETURNING 1
    )
    SELECT COUNT(*)::bigint AS deleted_count
    FROM deleted_rows;
  `);
};

const deleteExpiredAuditLogs = async (): Promise<number> => {
  return runDeleteCountQuery(Prisma.sql`
    WITH deleted_rows AS (
      DELETE FROM "audit_logs"
      WHERE "created_at" < (NOW() - (${env.auditLogRetentionDays} * INTERVAL '1 day'))
      RETURNING 1
    )
    SELECT COUNT(*)::bigint AS deleted_count
    FROM deleted_rows;
  `);
};

const cleanupSteps: CleanupStep[] = [
  {
    tableName: 'affiliate_links',
    retentionDaysLabel: 'por empresa',
    deleteExpiredRows: deleteExpiredAffiliateLinks
  },
  {
    tableName: 'api_request_logs',
    retentionDaysLabel: `${env.apiRequestLogRetentionDays}d`,
    deleteExpiredRows: deleteExpiredApiRequestLogs
  },
  {
    tableName: 'audit_logs',
    retentionDaysLabel: `${env.auditLogRetentionDays}d`,
    deleteExpiredRows: deleteExpiredAuditLogs
  }
];

const runHistoryCleanup = async (): Promise<void> => {
  if (isRunning) {
    cleanupLogger.warn(
      { eventType: 'history_cleanup_skipped', reason: 'already_running' },
      'history cleanup skipped'
    );
    return;
  }

  isRunning = true;
  const startedAt = Date.now();

  cleanupLogger.info({ eventType: 'history_cleanup_started' }, 'history cleanup started');

  try {
    for (const step of cleanupSteps) {
      await logTableMetrics('antes', step.tableName);
      const deletedCount = await step.deleteExpiredRows();
      cleanupLogger.info(
        {
          eventType: 'history_cleanup_table_pruned',
          tableName: step.tableName,
          retentionDays: step.retentionDaysLabel,
          removedRows: deletedCount
        },
        'history cleanup table pruned'
      );
      await logTableMetrics('depois', step.tableName);
    }
  } catch (error) {
    cleanupLogger.error(
      {
        eventType: 'history_cleanup_failed',
        err: error instanceof Error ? error : undefined,
        error: error instanceof Error ? undefined : error
      },
      'history cleanup failed'
    );
  } finally {
    const elapsedMs = Date.now() - startedAt;
    cleanupLogger.info(
      { eventType: 'history_cleanup_finished', durationMs: elapsedMs },
      'history cleanup finished'
    );
    isRunning = false;
  }
};

const startHistoryCleanupJob = (): void => {
  if (task) {
    return;
  }

  if (!cron.validate(HISTORY_CLEANUP_CRON)) {
    throw new Error(`Cron invalido para history cleanup: ${HISTORY_CLEANUP_CRON}`);
  }

  task = cron.schedule(HISTORY_CLEANUP_CRON, () => {
    void runHistoryCleanup();
  });

  cleanupLogger.info(
    { eventType: 'history_cleanup_scheduled', cron: HISTORY_CLEANUP_CRON },
    'history cleanup scheduled'
  );
};

export { runHistoryCleanup, startHistoryCleanupJob };
