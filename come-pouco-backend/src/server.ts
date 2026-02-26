import app from './app';
import env from './config/env';
import { checkDatabaseConnection } from './config/db';

const startServer = async (): Promise<void> => {
  try {
    await checkDatabaseConnection();

    app.listen(env.port, () => {
      console.log(`Backend rodando em http://localhost:${env.port}`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    console.error('Falha ao iniciar servidor:', message);
    process.exit(1);
  }
};

void startServer();
