import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';

import env from './config/env';
import routes from './routes';
import HttpError from './utils/httpError';

const app = express();

app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true
  })
);
app.use(express.json());
app.use('/api', routes);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const message = statusCode >= 500 ? 'Erro interno do servidor.' : error instanceof Error ? error.message : 'Erro inesperado.';
  const errorCode = error instanceof HttpError ? error.errorCode : 'INTERNAL_ERROR';

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    message,
    errorCode,
    details: env.appEnv === 'development' && error instanceof HttpError ? error.details : undefined
  });
});

export default app;
