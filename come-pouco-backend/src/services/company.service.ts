import { Prisma } from '@prisma/client';

import prisma from '../config/prisma';
import * as purchasePlatformService from './purchase-platform.service';
import { ALLOWED_HISTORY_RETENTION_DAYS } from '../constants/company.constants';
import HttpError from '../utils/httpError';

type ShopeeMode = 'TEST' | 'PROD';

type PlatformSummary = {
  id: number;
  name: string;
  type: 'SHOPEE';
  isActive: boolean;
};

interface CompanyRecord {
  id: number;
  name: string;
  historyRetentionDays: number;
  shopeeMode: ShopeeMode;
  shopeePlatform: PlatformSummary | null;
  shopeePlatformTest: PlatformSummary | null;
  shopeePlatformProd: PlatformSummary | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CompanyOutput {
  id: number;
  name: string;
  historyRetentionDays: number;
  shopeeMode: ShopeeMode;
  shopeePlatformId: number | null;
  shopeePlatformTestId: number | null;
  shopeePlatformProdId: number | null;
  shopeePlatform: PlatformSummary | null;
  shopeePlatformTest: PlatformSummary | null;
  shopeePlatformProd: PlatformSummary | null;
  activeShopeePlatformId: number | null;
  activeShopeePlatformSource: 'TEST' | 'PROD' | 'LEGACY' | null;
  isShopeeConfiguredForMode: boolean;
  createdAt: string;
  updatedAt: string;
}

type CompanyCreateInput = {
  name: string;
  historyRetentionDays?: number;
  shopeePlatformId?: number | null;
  shopeePlatformTestId?: number | null;
  shopeePlatformProdId?: number | null;
  shopeeMode?: ShopeeMode;
};

type CompanyUpdateInput = {
  name?: string;
  historyRetentionDays?: number;
  shopeePlatformId?: number | null;
  shopeePlatformTestId?: number | null;
  shopeePlatformProdId?: number | null;
  shopeeMode?: ShopeeMode;
};

const resolveActiveShopeePlatform = (company: CompanyRecord): { platformId: number | null; source: 'TEST' | 'PROD' | 'LEGACY' | null } => {
  if (company.shopeeMode === 'PROD') {
    return {
      platformId: company.shopeePlatformProd?.id ?? null,
      source: company.shopeePlatformProd?.id ? 'PROD' : null
    };
  }

  if (company.shopeePlatformTest?.id) {
    return {
      platformId: company.shopeePlatformTest.id,
      source: 'TEST'
    };
  }

  if (company.shopeePlatform?.id) {
    return {
      platformId: company.shopeePlatform.id,
      source: 'LEGACY'
    };
  }

  return {
    platformId: null,
    source: null
  };
};

const toCompanyOutput = (company: CompanyRecord): CompanyOutput => {
  const activeShopee = resolveActiveShopeePlatform(company);

  return {
    id: company.id,
    name: company.name,
    historyRetentionDays: company.historyRetentionDays,
    shopeeMode: company.shopeeMode,
    shopeePlatformId: company.shopeePlatform?.id ?? null,
    shopeePlatformTestId: company.shopeePlatformTest?.id ?? null,
    shopeePlatformProdId: company.shopeePlatformProd?.id ?? null,
    shopeePlatform: company.shopeePlatform,
    shopeePlatformTest: company.shopeePlatformTest,
    shopeePlatformProd: company.shopeePlatformProd,
    activeShopeePlatformId: activeShopee.platformId,
    activeShopeePlatformSource: activeShopee.source,
    isShopeeConfiguredForMode: Boolean(activeShopee.platformId),
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString()
  };
};

const companySelect = {
  id: true,
  name: true,
  historyRetentionDays: true,
  shopeeMode: true,
  shopeePlatform: {
    select: {
      id: true,
      name: true,
      type: true,
      isActive: true
    }
  },
  shopeePlatformTest: {
    select: {
      id: true,
      name: true,
      type: true,
      isActive: true
    }
  },
  shopeePlatformProd: {
    select: {
      id: true,
      name: true,
      type: true,
      isActive: true
    }
  },
  createdAt: true,
  updatedAt: true
} satisfies Prisma.CompanySelect;

const parseHistoryRetentionDays = (value: number | null | undefined): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, 'historyRetentionDays invalido.');
  }

  if (!ALLOWED_HISTORY_RETENTION_DAYS.includes(value)) {
    throw new HttpError(400, `historyRetentionDays invalido. Valores permitidos: ${ALLOWED_HISTORY_RETENTION_DAYS.join(', ')}.`);
  }

  return value;
};

const validateShopeePlatform = async (platformId: number | null | undefined): Promise<number | null | undefined> => {
  if (platformId === undefined) {
    return undefined;
  }

  if (platformId === null) {
    return null;
  }

  if (!Number.isInteger(platformId) || platformId <= 0) {
    throw new HttpError(400, 'Plataforma Shopee invalida.');
  }

  const platform = await purchasePlatformService.getPurchasePlatformById(platformId);

  if (!platform) {
    throw new HttpError(400, 'Plataforma Shopee nao encontrada.');
  }

  if (platform.type !== 'SHOPEE') {
    throw new HttpError(400, 'A plataforma selecionada precisa ser do tipo SHOPEE.');
  }

  if (!platform.isActive) {
    throw new HttpError(400, 'A plataforma Shopee selecionada precisa estar ativa.');
  }

  return platformId;
};

const connectOrDisconnectPlatform = (platformId: number | null | undefined): Prisma.PurchasePlatformUpdateOneWithoutCompaniesLegacyNestedInput | undefined => {
  if (platformId === undefined) {
    return undefined;
  }

  if (platformId === null) {
    return { disconnect: true };
  }

  return {
    connect: {
      id: platformId
    }
  };
};

const parseShopeeMode = (value: string | null | undefined): ShopeeMode | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value !== 'TEST' && value !== 'PROD') {
    throw new HttpError(400, 'Modo Shopee invalido. Use TEST ou PROD.');
  }

  return value;
};

const listCompanies = async (): Promise<CompanyOutput[]> => {
  const companies = await prisma.company.findMany({
    orderBy: { id: 'asc' },
    select: companySelect
  });

  return companies.map(toCompanyOutput);
};

const getCompanyById = async (id: number): Promise<CompanyRecord | null> => {
  return prisma.company.findUnique({ where: { id }, select: companySelect });
};

const createCompany = async ({
  name,
  historyRetentionDays,
  shopeePlatformId,
  shopeePlatformTestId,
  shopeePlatformProdId,
  shopeeMode
}: CompanyCreateInput): Promise<CompanyOutput> => {
  const validatedHistoryRetentionDays = parseHistoryRetentionDays(historyRetentionDays);
  const validatedLegacyId = await validateShopeePlatform(shopeePlatformId);
  const validatedTestId = await validateShopeePlatform(shopeePlatformTestId);
  const validatedProdId = await validateShopeePlatform(shopeePlatformProdId);
  const validatedMode = parseShopeeMode(shopeeMode) ?? 'TEST';

  try {
    const company = await prisma.company.create({
      data: {
        name: name.trim(),
        historyRetentionDays: validatedHistoryRetentionDays,
        shopeeMode: validatedMode,
        shopeePlatform: connectOrDisconnectPlatform(validatedLegacyId),
        shopeePlatformTest: connectOrDisconnectPlatform(validatedTestId),
        shopeePlatformProd: connectOrDisconnectPlatform(validatedProdId)
      },
      select: companySelect
    });

    return toCompanyOutput(company);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'Ja existe uma empresa com esse nome.');
    }

    throw error;
  }
};

const updateCompany = async (id: number, payload: CompanyUpdateInput): Promise<CompanyOutput> => {
  const updateData: Prisma.CompanyUpdateInput = {};

  if (payload.name !== undefined) {
    updateData.name = payload.name.trim();
  }

  if (payload.shopeeMode !== undefined) {
    updateData.shopeeMode = parseShopeeMode(payload.shopeeMode)!;
  }

  if (payload.historyRetentionDays !== undefined) {
    updateData.historyRetentionDays = parseHistoryRetentionDays(payload.historyRetentionDays);
  }

  if (payload.shopeePlatformId !== undefined) {
    const validatedLegacyId = await validateShopeePlatform(payload.shopeePlatformId);
    updateData.shopeePlatform = connectOrDisconnectPlatform(validatedLegacyId);
  }

  if (payload.shopeePlatformTestId !== undefined) {
    const validatedTestId = await validateShopeePlatform(payload.shopeePlatformTestId);
    updateData.shopeePlatformTest = connectOrDisconnectPlatform(validatedTestId);
  }

  if (payload.shopeePlatformProdId !== undefined) {
    const validatedProdId = await validateShopeePlatform(payload.shopeePlatformProdId);
    updateData.shopeePlatformProd = connectOrDisconnectPlatform(validatedProdId);
  }

  if (!Object.keys(updateData).length) {
    throw new HttpError(400, 'Informe ao menos um campo para atualizacao.');
  }

  try {
    const company = await prisma.company.update({
      where: { id },
      data: updateData,
      select: companySelect
    });

    return toCompanyOutput(company);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new HttpError(404, 'Empresa nao encontrada.');
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'Ja existe uma empresa com esse nome.');
    }

    throw error;
  }
};

export { createCompany, getCompanyById, listCompanies, resolveActiveShopeePlatform, updateCompany };
export type { CompanyOutput, CompanyRecord, ShopeeMode };
