import { Prisma } from '@prisma/client';

import prisma from '../config/prisma';
import HttpError from '../utils/httpError';

interface PlatformCompanyLinkRow {
  company_id: number;
  company_name: string;
  is_default_for_company: boolean;
  created_at: Date;
}

interface PlatformCompanyLinkOutput {
  companyId: number;
  companyName: string;
  isDefaultForCompany: boolean;
  createdAt: string;
}

interface ReplacePlatformCompaniesInput {
  companyIds: number[];
  defaultCompanyIds: number[];
}

const toOutput = (row: PlatformCompanyLinkRow): PlatformCompanyLinkOutput => ({
  companyId: row.company_id,
  companyName: row.company_name,
  isDefaultForCompany: row.is_default_for_company,
  createdAt: row.created_at.toISOString()
});

const normalizeDistinctPositiveIds = (ids: number[]): number[] => {
  const set = new Set<number>();

  ids.forEach((id) => {
    if (Number.isInteger(id) && id > 0) {
      set.add(id);
    }
  });

  return Array.from(set.values());
};

const listCompaniesByPlatform = async (platformId: number): Promise<PlatformCompanyLinkOutput[]> => {
  const rows = await prisma.$queryRaw<PlatformCompanyLinkRow[]>(Prisma.sql`
    SELECT
      cp.company_id,
      c.name AS company_name,
      cp.is_default_for_company,
      cp.created_at
    FROM company_platforms cp
    INNER JOIN companies c ON c.id = cp.company_id
    WHERE cp.platform_id = ${platformId}
    ORDER BY c.name ASC
  `);

  return rows.map(toOutput);
};

const replaceCompaniesByPlatform = async (
  platformId: number,
  { companyIds, defaultCompanyIds }: ReplacePlatformCompaniesInput
): Promise<PlatformCompanyLinkOutput[]> => {
  const normalizedCompanyIds = normalizeDistinctPositiveIds(companyIds);
  const normalizedDefaultCompanyIds = normalizeDistinctPositiveIds(defaultCompanyIds);

  const platform = await prisma.$queryRaw<Array<{ id: number; type: 'SHOPEE' }>>(Prisma.sql`
    SELECT id, type
    FROM purchase_platforms
    WHERE id = ${platformId}
    LIMIT 1
  `);

  if (!platform.length) {
    throw new HttpError(404, 'Plataforma de compras nao encontrada.');
  }

  if (normalizedCompanyIds.length) {
    const companies = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT id
      FROM companies
      WHERE id IN (${Prisma.join(normalizedCompanyIds)})
    `);

    if (companies.length !== normalizedCompanyIds.length) {
      throw new HttpError(400, 'Uma ou mais empresas informadas nao existem.');
    }
  }

  if (normalizedDefaultCompanyIds.some((id) => !normalizedCompanyIds.includes(id))) {
    throw new HttpError(400, 'defaultCompanyIds deve ser subconjunto de companyIds.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`DELETE FROM company_platforms WHERE platform_id = ${platformId}`);

    if (normalizedCompanyIds.length) {
      await Promise.all(
        normalizedCompanyIds.map((companyId) =>
          tx.$executeRaw(Prisma.sql`
            INSERT INTO company_platforms (company_id, platform_id, is_default_for_company, created_at)
            VALUES (${companyId}, ${platformId}, ${normalizedDefaultCompanyIds.includes(companyId)}, NOW())
          `)
        )
      );
    }

    if (platform[0].type === 'SHOPEE' && normalizedDefaultCompanyIds.length) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE company_platforms cp
        SET is_default_for_company = false
        FROM purchase_platforms pp
        WHERE cp.platform_id = pp.id
          AND pp.type = CAST('SHOPEE' AS "PurchasePlatformType")
          AND cp.company_id IN (${Prisma.join(normalizedDefaultCompanyIds)})
          AND cp.platform_id <> ${platformId}
      `);
    }
  });

  return listCompaniesByPlatform(platformId);
};

const mapPlatformRow = (row: {
  id: number;
  name: string;
  description: string;
  type: 'SHOPEE';
  app_id: string;
  secret: string;
  is_active: boolean;
  mock_mode: boolean;
  api_url: string;
  api_link: string;
  access_key: string;
  created_at: Date;
  updated_at: Date;
}) => ({
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

const getShopeePlatformForCompany = async (companyId: number) => {
  const defaultRows = await prisma.$queryRaw<Array<{
    id: number;
    name: string;
    description: string;
    type: 'SHOPEE';
    app_id: string;
    secret: string;
    is_active: boolean;
    mock_mode: boolean;
    api_url: string;
    api_link: string;
    access_key: string;
    created_at: Date;
    updated_at: Date;
  }>>(Prisma.sql`
    SELECT
      pp.id,
      pp.name,
      pp.description,
      pp.type,
      pp.app_id,
      pp.secret,
      pp.is_active,
      pp.mock_mode,
      pp.api_url,
      pp.api_link,
      pp.access_key,
      pp.created_at,
      pp.updated_at
    FROM company_platforms cp
    INNER JOIN purchase_platforms pp ON pp.id = cp.platform_id
    WHERE cp.company_id = ${companyId}
      AND cp.is_default_for_company = true
      AND pp.type = CAST('SHOPEE' AS "PurchasePlatformType")
    ORDER BY cp.created_at DESC
    LIMIT 1
  `);

  if (defaultRows.length) {
    return mapPlatformRow(defaultRows[0]);
  }

  const linkedRows = await prisma.$queryRaw<Array<{
    id: number;
    name: string;
    description: string;
    type: 'SHOPEE';
    app_id: string;
    secret: string;
    is_active: boolean;
    mock_mode: boolean;
    api_url: string;
    api_link: string;
    access_key: string;
    created_at: Date;
    updated_at: Date;
  }>>(Prisma.sql`
    SELECT
      pp.id,
      pp.name,
      pp.description,
      pp.type,
      pp.app_id,
      pp.secret,
      pp.is_active,
      pp.mock_mode,
      pp.api_url,
      pp.api_link,
      pp.access_key,
      pp.created_at,
      pp.updated_at
    FROM company_platforms cp
    INNER JOIN purchase_platforms pp ON pp.id = cp.platform_id
    WHERE cp.company_id = ${companyId}
      AND pp.type = CAST('SHOPEE' AS "PurchasePlatformType")
    ORDER BY cp.created_at DESC
  `);

  if (linkedRows.length === 1) {
    return mapPlatformRow(linkedRows[0]);
  }

  return null;
};

export { getShopeePlatformForCompany, listCompaniesByPlatform, replaceCompaniesByPlatform };
export type { PlatformCompanyLinkOutput, ReplacePlatformCompaniesInput };
