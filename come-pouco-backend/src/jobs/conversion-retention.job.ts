import cron, { ScheduledTask } from 'node-cron';

import env from '../config/env';
import { logger } from '../lib/logger';
import { anonymizeConversionsOlderThan } from '../services/conversion-retention.service';

const CONVERSION_RETENTION_CRON = '30 3 * * *';
const DAY_MS = 24 * 60 * 60 * 1000;
const retentionLogger = logger.child({ scope: 'conversion-retention' });

let task: ScheduledTask | null = null;
let isRunning = false;

const getRetentionCutoff = (): Date => new Date(Date.now() - env.conversionRetentionDays * DAY_MS);

const runConversionRetention = async (): Promise<void> => {
  if (isRunning) {
    retentionLogger.warn(
      { eventType: 'conversion_retention_skipped', reason: 'already_running' },
      'conversion retention skipped'
    );
    return;
  }

  isRunning = true;
  const startedAt = Date.now();
  const olderThan = getRetentionCutoff();

  retentionLogger.info(
    {
      eventType: 'conversion_retention_started',
      retentionDays: env.conversionRetentionDays,
      olderThan: olderThan.toISOString()
    },
    'conversion retention started'
  );

  try {
    const result = await anonymizeConversionsOlderThan(olderThan);
    retentionLogger.info(
      {
        eventType: 'conversion_retention_anonymized',
        retentionDays: env.conversionRetentionDays,
        olderThan: result.olderThan,
        anonymizedRows: result.anonymizedCount
      },
      'conversion retention anonymized rows'
    );
  } catch (error) {
    retentionLogger.error(
      {
        eventType: 'conversion_retention_failed',
        err: error instanceof Error ? error : undefined,
        error: error instanceof Error ? undefined : error
      },
      'conversion retention failed'
    );
  } finally {
    retentionLogger.info(
      {
        eventType: 'conversion_retention_finished',
        durationMs: Date.now() - startedAt
      },
      'conversion retention finished'
    );
    isRunning = false;
  }
};

const startConversionRetentionJob = (): void => {
  if (task) {
    return;
  }

  if (!cron.validate(CONVERSION_RETENTION_CRON)) {
    throw new Error(`Cron invalido para conversion retention: ${CONVERSION_RETENTION_CRON}`);
  }

  task = cron.schedule(CONVERSION_RETENTION_CRON, () => {
    void runConversionRetention();
  });

  retentionLogger.info(
    {
      eventType: 'conversion_retention_scheduled',
      cron: CONVERSION_RETENTION_CRON,
      retentionDays: env.conversionRetentionDays
    },
    'conversion retention scheduled'
  );
};

export { runConversionRetention, startConversionRetentionJob };
