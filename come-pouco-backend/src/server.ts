import app from './app';
import env from './config/env';
import { checkDatabaseConnection, ensureDatabaseSchema } from './config/db';
import prisma from './config/prisma';

const startServer = async (): Promise<void> => {
  try {
    await checkDatabaseConnection();
    await ensureDatabaseSchema();

    app.listen(env.port, () => {
      console.log(`Backend rodando em http://localhost:${env.port}`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    console.error('Falha ao iniciar servidor:', message);
    await prisma.$disconnect();
    process.exit(1);
  }
};

const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`Recebido ${signal}. Encerrando servidor...`);
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
