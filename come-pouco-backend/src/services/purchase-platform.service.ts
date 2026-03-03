import { Prisma } from '@prisma/client';

import prisma from '../config/prisma';
import HttpError from '../utils/httpError';

type PurchasePlatformType = 'SHOPEE';

interface PurchasePlatformRow {
  id: number;
  name: string;
  description: string;
  type: PurchasePlatformType;
  app_id: string;
  secret: string;
  is_active: boolean;
  mock_mode: boolean;
  api_url: string;
  api_link: string;
  access_key: string;
  created_at: Date;
  updated_at: Date;
}

interface PurchasePlatformRecord {
  id: number;
  name: string;
  description: string;
  type: PurchasePlatformType;
  appId: string;
  secret: string;
  isActive: boolean;
  mockMode: boolean;
  apiUrl: string;
  apiLink: string;
  accessKey: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PurchasePlatformOutput {
  id: number;
  name: string;
  description: string;
  type: PurchasePlatformType;
  appId: string;
  isActive: boolean;
  mockMode: boolean;
  apiUrl: string;
  apiLink: string;
  accessKey: string;
  secretConfigured: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreatePurchasePlatformInput {
  name: string;
  description: string;
  type: PurchasePlatformType;
  appId: string;
  secret: string;
  isActive: boolean;
  mockMode: boolean;
  apiUrl: string;
  apiLink?: string;
  accessKey?: string;
}

interface UpdatePurchasePlatformInput {
  name?: string;
  description?: string;
  type?: PurchasePlatformType;
  appId?: string;
  secret?: string;
  isActive?: boolean;
  mockMode?: boolean;
  apiUrl?: string;
  apiLink?: string;
  accessKey?: string;
}

const mapRowToRecord = (row: PurchasePlatformRow): PurchasePlatformRecord => ({
  id: row.id,
  name: row.name,
  description: row.description,
  type: row.type,
  appId: row.app_id,
  secret: row.secret,
  isActive: row.is_active,
  mockMode: row.mock_mode,
  apiUrl: row.api_url,
  apiLink: row.api_link,
  accessKey: row.access_key,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toPurchasePlatformOutput = (platform: PurchasePlatformRecord): PurchasePlatformOutput => ({
  id: platform.id,
  name: platform.name,
  description: platform.description,
  type: platform.type,
  appId: platform.appId,
  isActive: platform.isActive,
  mockMode: platform.mockMode,
  apiUrl: platform.apiUrl,
  apiLink: platform.apiLink,
  accessKey: platform.accessKey ? '********' : 'nao configurado',
  secretConfigured: platform.secret.trim().length > 0,
  createdAt: platform.createdAt.toISOString(),
  updatedAt: platform.updatedAt.toISOString()
});

const listPurchasePlatforms = async (): Promise<PurchasePlatformOutput[]> => {
  const rows = await prisma.$queryRaw<PurchasePlatformRow[]>(Prisma.sql`
    SELECT
      id,
      name,
      description,
      type,
      app_id,
      secret,
      is_active,
      mock_mode,
      api_url,
      api_link,
      access_key,
      created_at,
      updated_at
    FROM purchase_platforms
    ORDER BY id DESC
  `);

  return rows.map((row) => toPurchasePlatformOutput(mapRowToRecord(row)));
};

const createPurchasePlatform = async ({
  name,
  description,
  type,
  appId,
  secret,
  isActive,
  mockMode,
  apiUrl,
  apiLink,
  accessKey
}: CreatePurchasePlatformInput): Promise<PurchasePlatformOutput> => {
  const normalizedApiUrl = apiUrl.trim();
  const normalizedSecret = secret.trim();

  const rows = await prisma.$queryRaw<PurchasePlatformRow[]>(Prisma.sql`
    INSERT INTO purchase_platforms (
      name,
      description,
      type,
      app_id,
      secret,
      is_active,
      mock_mode,
      api_url,
      api_link,
      access_key,
      created_at,
      updated_at
    )
    VALUES (
      ${name.trim()},
      ${description.trim()},
      CAST(${type} AS "PurchasePlatformType"),
      ${appId.trim()},
      ${normalizedSecret},
      ${isActive},
      ${mockMode},
      ${normalizedApiUrl},
      ${(apiLink || normalizedApiUrl).trim()},
      ${(accessKey || normalizedSecret).trim()},
      NOW(),
      NOW()
    )
    RETURNING
      id,
      name,
      description,
      type,
      app_id,
      secret,
      is_active,
      mock_mode,
      api_url,
      api_link,
      access_key,
      created_at,
      updated_at
  `);

  return toPurchasePlatformOutput(mapRowToRecord(rows[0]));
};

const updatePurchasePlatform = async (
  id: number,
  { name, description, type, appId, secret, isActive, mockMode, apiUrl, apiLink, accessKey }: UpdatePurchasePlatformInput
): Promise<PurchasePlatformOutput> => {
  const updateClauses: Prisma.Sql[] = [];

  if (name !== undefined) {
    updateClauses.push(Prisma.sql`name = ${name.trim()}`);
  }

  if (description !== undefined) {
    updateClauses.push(Prisma.sql`description = ${description.trim()}`);
  }

  if (type !== undefined) {
    updateClauses.push(Prisma.sql`type = CAST(${type} AS "PurchasePlatformType")`);
  }

  if (appId !== undefined) {
    updateClauses.push(Prisma.sql`app_id = ${appId.trim()}`);
  }

  if (secret !== undefined) {
    const normalizedSecret = secret.trim();
    updateClauses.push(Prisma.sql`secret = ${normalizedSecret}`);
    updateClauses.push(Prisma.sql`access_key = ${normalizedSecret}`);
  }

  if (isActive !== undefined) {
    updateClauses.push(Prisma.sql`is_active = ${isActive}`);
  }

  if (mockMode !== undefined) {
    updateClauses.push(Prisma.sql`mock_mode = ${mockMode}`);
  }

  if (apiUrl !== undefined) {
    const normalizedApiUrl = apiUrl.trim();
    updateClauses.push(Prisma.sql`api_url = ${normalizedApiUrl}`);
    updateClauses.push(Prisma.sql`api_link = ${normalizedApiUrl}`);
  }

  if (apiLink !== undefined) {
    updateClauses.push(Prisma.sql`api_link = ${apiLink.trim()}`);
  }

  if (accessKey !== undefined) {
    updateClauses.push(Prisma.sql`access_key = ${accessKey.trim()}`);
  }

  if (!updateClauses.length) {
    throw new HttpError(400, 'Informe ao menos um campo para atualizacao.');
  }

  const rows = await prisma.$queryRaw<PurchasePlatformRow[]>(Prisma.sql`
    UPDATE purchase_platforms
    SET
      ${Prisma.join(updateClauses, ', ')},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING
      id,
      name,
      description,
      type,
      app_id,
      secret,
      is_active,
      mock_mode,
      api_url,
      api_link,
      access_key,
      created_at,
      updated_at
  `);

  if (!rows.length) {
    throw new HttpError(404, 'Plataforma de compras nao encontrada.');
  }

  return toPurchasePlatformOutput(mapRowToRecord(rows[0]));
};

const getPurchasePlatformById = async (id: number): Promise<PurchasePlatformRecord | null> => {
  const rows = await prisma.$queryRaw<PurchasePlatformRow[]>(Prisma.sql`
    SELECT
      id,
      name,
      description,
      type,
      app_id,
      secret,
      is_active,
      mock_mode,
      api_url,
      api_link,
      access_key,
      created_at,
      updated_at
    FROM purchase_platforms
    WHERE id = ${id}
    LIMIT 1
  `);

  if (!rows.length) {
    return null;
  }

  return mapRowToRecord(rows[0]);
};

const deletePurchasePlatform = async (id: number): Promise<void> => {
  const deletedRows = await prisma.$executeRaw(Prisma.sql`DELETE FROM purchase_platforms WHERE id = ${id}`);

  if (!Number(deletedRows)) {
    throw new HttpError(404, 'Plataforma de compras nao encontrada.');
  }
};

export {
  createPurchasePlatform,
  deletePurchasePlatform,
  getPurchasePlatformById,
  listPurchasePlatforms,
  updatePurchasePlatform
};
