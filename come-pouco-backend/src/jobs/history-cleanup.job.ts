import { Prisma } from '@prisma/client';
import cron, { ScheduledTask } from 'node-cron';

import prisma from '../config/prisma';

const HISTORY_CLEANUP_CRON = '0 3 * * *';

let task: ScheduledTask | null = null;
let isRunning = false;

const runHistoryCleanup = async (): Promise<void> => {
  if (isRunning) {
    console.warn('[history-cleanup] execucao ignorada: job ainda em andamento.');
    return;
  }

  isRunning = true;
  const startedAt = Date.now();

  console.log('[history-cleanup] inicio.');

  try {
    const rows = await prisma.$queryRaw<Array<{ deleted_count: number | string }>>(Prisma.sql`
      WITH deleted_rows AS (
        DELETE FROM "affiliate_links" al
        USING "companies" c
        WHERE al."company_id" = c."id"
          AND c."history_retention_days" IS NOT NULL
          AND c."history_retention_days" > 0
          AND al."created_at" < (NOW() - (c."history_retention_days" * INTERVAL '1 day'))
        RETURNING 1
      )
      SELECT COUNT(*)::int AS deleted_count
      FROM deleted_rows;
    `);

    const deletedCount = Number(rows[0]?.deleted_count ?? 0);
    console.log(`[history-cleanup] registros removidos: ${deletedCount}.`);
  } catch (error) {
    console.error('[history-cleanup] erro na execucao:', error);
  } finally {
    const elapsedMs = Date.now() - startedAt;
    console.log(`[history-cleanup] fim. duracao=${elapsedMs}ms.`);
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

  console.log(`[history-cleanup] agendado para '${HISTORY_CLEANUP_CRON}' (03:00 diario).`);
};

export { startHistoryCleanupJob };
