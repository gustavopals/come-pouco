const app = require('./app');
const env = require('./config/env');
const { checkDatabaseConnection } = require('./config/db');

const startServer = async () => {
  try {
    await checkDatabaseConnection();

    app.listen(env.port, () => {
      console.log(`Backend rodando em http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error('Falha ao iniciar servidor:', error.message);
    process.exit(1);
  }
};

startServer();
