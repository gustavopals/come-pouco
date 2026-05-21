import { captureBackendException, flushSentry } from './lib/sentry';
import app from './app';
import env from './config/env';
import { checkDatabaseConnection, ensureDatabaseSchema } from './config/db';
import prisma from './config/prisma';
import { startConversionRetentionJob } from './jobs/conversion-retention.job';
import { startHistoryCleanupJob } from './jobs/history-cleanup.job';
import { logger } from './lib/logger';

const startServer = async (): Promise<void> => {
  try {
    await checkDatabaseConnection();
    await ensureDatabaseSchema();
    startHistoryCleanupJob();
    startConversionRetentionJob();

    app.listen(env.port, () => {
      logger.info(
        { eventType: 'server_started', port: env.port },
        `Backend rodando em http://localhost:${env.port}`
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    logger.fatal(
      {
        eventType: 'server_start_failed',
        err: error instanceof Error ? error : undefined,
        message
      },
      'Falha ao iniciar servidor'
    );
    captureBackendException(error, { eventType: 'server_start_failed' });
    await flushSentry();
    await prisma.$disconnect();
    process.exit(1);
  }
};

const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(
    { eventType: 'server_shutdown_started', signal },
    `Recebido ${signal}. Encerrando servidor...`
  );
  await flushSentry();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

void startServer();
