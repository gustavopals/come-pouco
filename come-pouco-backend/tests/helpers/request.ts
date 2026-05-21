import request from 'supertest';
import type { Express } from 'express';

export const createRequest = (app: Express) => request(app);

export type TestRequest = ReturnType<typeof createRequest>;
