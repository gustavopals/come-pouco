import type { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';

export type PrismaMock = DeepMockProxy<PrismaClient>;

export const createPrismaMock = (): PrismaMock => mockDeep<PrismaClient>();

export const resetPrismaMock = (prismaMock: PrismaMock): void => {
  mockReset(prismaMock);
};
