import prisma from './prisma';

const checkDatabaseConnection = async (): Promise<void> => {
  await prisma.$connect();
};

const ensureDatabaseSchema = async (): Promise<void> => {
  // Database schema is managed through Prisma migrations.
};

export { ensureDatabaseSchema, checkDatabaseConnection };
