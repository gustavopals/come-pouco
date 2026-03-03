import { Prisma } from '@prisma/client';

import env from './env';
import prisma from './prisma';

const REQUIRED_AUTH_COLUMNS = [
  'username',
  'two_factor_enabled',
  'two_factor_secret',
  'two_factor_secret_pending',
  'two_factor_pending_created_at',
  'two_factor_confirmed_at'
] as const;

const checkDatabaseConnection = async (): Promise<void> => {
  await prisma.$connect();
};

const ensureAuthSchemaColumns = async (): Promise<void> => {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
  `;

  const existing = new Set(rows.map((row) => row.column_name));
  const missing = REQUIRED_AUTH_COLUMNS.filter((column) => !existing.has(column));

  if (missing.length) {
    throw new Error(
      `Auth schema desatualizado. Colunas ausentes em users: ${missing.join(', ')}. Banco nao migrado. Execute: npx prisma migrate deploy`
    );
  }
};

const ensureMasterAdminSeed = async (): Promise<void> => {
  const admin = await prisma.user.findFirst({
    where: {
      OR: [{ username: 'admin' }, { email: 'admin@comepouco.local' }]
    },
    select: { id: true, username: true, email: true, role: true }
  });

  if (!admin) {
    throw new Error('Usuario master admin nao encontrado. Execute seed/migration de bootstrap.');
  }

  if (admin.role !== 'ADMIN') {
    throw new Error(`Usuario master admin sem role ADMIN (id=${admin.id}). Corrija seed/migration do ambiente.`);
  }
};

const ensureDatabaseSchema = async (): Promise<void> => {
  if (env.appEnv === 'production') {
    return;
  }

  try {
    await ensureAuthSchemaColumns();
    await ensureMasterAdminSeed();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2021' || error.code === 'P2022')) {
      throw new Error('Banco nao migrado. Execute: npx prisma migrate deploy');
    }

    throw error;
  }
};

export { ensureDatabaseSchema, checkDatabaseConnection };
