import { Prisma } from '@prisma/client';

import prisma from '../config/prisma';
import {
  DEFAULT_HOW_IT_WORKS_STEPS,
  createDefaultLandingConfigData
} from '../constants/landing-config.constants';
import type { CompanyRole } from '../types/company-role';
import type { UserRole } from '../types/user-role';
import HttpError from '../utils/httpError';
import { parseShopeeUrl } from './shopee-url-parser.service';
import {
  assertCompanyPublicSlugAvailable,
  assertUserPublicSlugAvailable,
  mapPublicSlugPrismaError,
  normalizePublicSlugInput
} from './public-slug.service';

interface AccessScope {
  requesterRole: UserRole;
  requesterCompanyId: number | null;
  requesterCompanyRole: CompanyRole | null;
}

interface LandingConfigOutput {
  company: {
    id: number;
    name: string;
    publicSlug: string | null;
    fallbackAffiliateUrl: string | null;
  };
  landingConfig: {
    id: number;
    companyId: number;
    bannerText: string;
    bannerEmoji: string;
    heroTitle: string;
    heroSubtitle: string;
    howItWorksSteps: string[];
    primaryColor: string;
    logoUrl: string | null;
    isActive: boolean;
    updatedAt: string;
  };
}

interface UpdateLandingConfigInput {
  bannerText?: string;
  bannerEmoji?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  howItWorksSteps?: string[];
  primaryColor?: string;
  logoUrl?: string | null;
  isActive?: boolean;
}

type LandingConfigMutationData = Partial<{
  bannerText: string;
  bannerEmoji: string;
  heroTitle: string;
  heroSubtitle: string;
  howItWorksSteps: Prisma.InputJsonValue;
  primaryColor: string;
  logoUrl: string | null;
  isActive: boolean;
}>;

const landingConfigSelect = {
  id: true,
  companyId: true,
  bannerText: true,
  bannerEmoji: true,
  heroTitle: true,
  heroSubtitle: true,
  howItWorksSteps: true,
  primaryColor: true,
  logoUrl: true,
  isActive: true,
  updatedAt: true
} satisfies Prisma.LandingConfigSelect;

const companyLandingSelect = {
  id: true,
  name: true,
  publicSlug: true,
  fallbackAffiliateUrl: true,
  landingConfig: {
    select: landingConfigSelect
  }
} satisfies Prisma.CompanySelect;

const getLandingConfig = async (
  companyId: number,
  scope: AccessScope
): Promise<LandingConfigOutput> => {
  const company = await getCompanyOrThrow(companyId);
  assertCanManageCompany(company.id, scope);

  const landingConfig =
    company.landingConfig ??
    (await prisma.landingConfig.create({
      data: {
        companyId: company.id,
        ...createDefaultLandingConfigData()
      },
      select: landingConfigSelect
    }));

  return toLandingConfigOutput({
    ...company,
    landingConfig
  });
};

const updateLandingConfig = async (
  companyId: number,
  input: UpdateLandingConfigInput,
  scope: AccessScope
): Promise<LandingConfigOutput> => {
  const company = await getCompanyOrThrow(companyId);
  assertCanManageCompany(company.id, scope);

  const updateData = buildLandingConfigUpdateData(input);

  if (!Object.keys(updateData).length) {
    throw new HttpError(
      400,
      'Informe ao menos um campo para atualizacao.',
      'LANDING_CONFIG_EMPTY_UPDATE'
    );
  }

  const landingConfig = await prisma.landingConfig.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      ...createDefaultLandingConfigData(),
      ...updateData
    },
    update: updateData,
    select: landingConfigSelect
  });

  return toLandingConfigOutput({
    ...company,
    landingConfig
  });
};

const updateCompanyPublicSlug = async (
  companyId: number,
  publicSlug: string | null | undefined,
  scope: AccessScope
): Promise<LandingConfigOutput> => {
  const company = await getCompanyOrThrow(companyId);
  assertCanManageCompany(company.id, scope);

  const normalizedPublicSlug = normalizePublicSlugInput(publicSlug, { nullable: true });
  await assertCompanyPublicSlugAvailable(normalizedPublicSlug, company.id);

  try {
    const updatedCompany = await prisma.company.update({
      where: { id: company.id },
      data: { publicSlug: normalizedPublicSlug },
      select: companyLandingSelect
    });

    return toLandingConfigOutput({
      ...updatedCompany,
      landingConfig:
        updatedCompany.landingConfig ??
        (await prisma.landingConfig.create({
          data: {
            companyId: updatedCompany.id,
            ...createDefaultLandingConfigData()
          },
          select: landingConfigSelect
        }))
    });
  } catch (error) {
    return mapPublicSlugPrismaError(error);
  }
};

const updateCompanyFallbackAffiliateUrl = async (
  companyId: number,
  fallbackAffiliateUrl: string | null | undefined,
  scope: AccessScope
): Promise<LandingConfigOutput> => {
  const company = await getCompanyOrThrow(companyId);
  assertCanManageCompany(company.id, scope);

  const normalizedFallbackUrl = normalizeFallbackShopeeUrl(fallbackAffiliateUrl);
  const updatedCompany = await prisma.company.update({
    where: { id: company.id },
    data: { fallbackAffiliateUrl: normalizedFallbackUrl },
    select: companyLandingSelect
  });

  return toLandingConfigOutput({
    ...updatedCompany,
    landingConfig:
      updatedCompany.landingConfig ??
      (await prisma.landingConfig.create({
        data: {
          companyId: updatedCompany.id,
          ...createDefaultLandingConfigData()
        },
        select: landingConfigSelect
      }))
  });
};

const updateUserPublicSlug = async (
  userId: number,
  publicSlug: string | null | undefined,
  scope: AccessScope
) => {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      role: true,
      companyId: true,
      companyRole: true,
      publicSlug: true,
      twoFactorEnabled: true,
      createdAt: true
    }
  });

  if (!target) {
    throw new HttpError(404, 'Usuario nao encontrado.', 'USER_NOT_FOUND');
  }

  assertCanManageUserSlug(target, scope);

  const normalizedPublicSlug = normalizePublicSlugInput(publicSlug, { nullable: true });

  if (normalizedPublicSlug && !target.companyId) {
    throw new HttpError(
      400,
      'Usuario sem empresa nao pode ter slug publico.',
      'PUBLIC_USER_SLUG_COMPANY_MISSING'
    );
  }

  if (normalizedPublicSlug && target.role === 'ADMIN') {
    throw new HttpError(400, 'ADMIN nao pode ter slug publico.', 'PUBLIC_USER_SLUG_ADMIN_INVALID');
  }

  if (target.companyId) {
    await assertUserPublicSlugAvailable(target.companyId, normalizedPublicSlug, target.id);
  }

  try {
    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        publicSlug: target.role === 'ADMIN' ? null : normalizedPublicSlug
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        role: true,
        companyId: true,
        companyRole: true,
        publicSlug: true,
        twoFactorEnabled: true,
        createdAt: true
      }
    });

    return {
      user: {
        ...user,
        createdAt: user.createdAt.toISOString()
      }
    };
  } catch (error) {
    return mapPublicSlugPrismaError(error);
  }
};

const getCompanyOrThrow = async (companyId: number) => {
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new HttpError(400, 'Empresa invalida.', 'COMPANY_ID_INVALID');
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: companyLandingSelect
  });

  if (!company) {
    throw new HttpError(404, 'Empresa nao encontrada.', 'COMPANY_NOT_FOUND');
  }

  return company;
};

const assertCanManageCompany = (companyId: number, scope: AccessScope): void => {
  if (scope.requesterRole === 'ADMIN') {
    return;
  }

  if (
    scope.requesterRole === 'USER' &&
    scope.requesterCompanyRole === 'OWNER' &&
    scope.requesterCompanyId === companyId
  ) {
    return;
  }

  throw new HttpError(
    403,
    'Acesso negado para configurar landing publica.',
    'LANDING_CONFIG_FORBIDDEN'
  );
};

const assertCanManageUserSlug = (
  target: { role: UserRole; companyId: number | null; companyRole: CompanyRole | null },
  scope: AccessScope
): void => {
  if (scope.requesterRole === 'ADMIN') {
    return;
  }

  if (
    scope.requesterRole === 'USER' &&
    scope.requesterCompanyRole === 'OWNER' &&
    scope.requesterCompanyId &&
    target.role === 'USER' &&
    target.companyRole === 'EMPLOYEE' &&
    target.companyId === scope.requesterCompanyId
  ) {
    return;
  }

  throw new HttpError(
    403,
    'Acesso negado para atualizar slug publico do usuario.',
    'PUBLIC_USER_SLUG_FORBIDDEN'
  );
};

const buildLandingConfigUpdateData = (
  input: UpdateLandingConfigInput
): LandingConfigMutationData => {
  const updateData: LandingConfigMutationData = {};

  if (input.bannerText !== undefined) {
    updateData.bannerText = input.bannerText.trim();
  }

  if (input.bannerEmoji !== undefined) {
    updateData.bannerEmoji = input.bannerEmoji.trim();
  }

  if (input.heroTitle !== undefined) {
    updateData.heroTitle = input.heroTitle.trim();
  }

  if (input.heroSubtitle !== undefined) {
    updateData.heroSubtitle = input.heroSubtitle.trim();
  }

  if (input.howItWorksSteps !== undefined) {
    updateData.howItWorksSteps = normalizeHowItWorksSteps(input.howItWorksSteps);
  }

  if (input.primaryColor !== undefined) {
    updateData.primaryColor = input.primaryColor.trim();
  }

  if (input.logoUrl !== undefined) {
    updateData.logoUrl = normalizeOptionalUrl(input.logoUrl, 'URL do logo');
  }

  if (input.isActive !== undefined) {
    updateData.isActive = input.isActive;
  }

  return updateData;
};

const normalizeHowItWorksSteps = (steps: string[]): string[] => {
  const normalized = steps.map((step) => step.trim()).filter(Boolean);

  if (normalized.length < 1 || normalized.length > 4) {
    throw new HttpError(400, 'Informe de 1 a 4 passos.', 'LANDING_STEPS_INVALID_COUNT');
  }

  return normalized;
};

const normalizeOptionalUrl = (
  value: string | null | undefined,
  fieldLabel: string
): string | null => {
  if (value === undefined || value === null || value.trim() === '') {
    return null;
  }

  const normalized = value.trim();

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('invalid protocol');
    }
  } catch {
    throw new HttpError(400, `${fieldLabel} invalida.`, 'LANDING_URL_INVALID');
  }

  return normalized;
};

const normalizeFallbackShopeeUrl = (value: string | null | undefined): string | null => {
  const normalized = normalizeOptionalUrl(value, 'URL de fallback');

  if (!normalized) {
    return null;
  }

  const analysis = parseShopeeUrl(normalized);
  if (!analysis.valid) {
    throw new HttpError(
      400,
      'URL de fallback precisa ser uma URL da Shopee.',
      'LANDING_FALLBACK_SHOPEE_INVALID'
    );
  }

  return normalized;
};

const toSteps = (value: Prisma.JsonValue): string[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_HOW_IT_WORKS_STEPS];
  }

  const steps = value
    .filter((step): step is string => typeof step === 'string' && step.trim().length > 0)
    .map((step) => step.trim());
  return steps.length ? steps : [...DEFAULT_HOW_IT_WORKS_STEPS];
};

const toLandingConfigOutput = (
  company: NonNullable<Awaited<ReturnType<typeof getCompanyOrThrow>>>
): LandingConfigOutput => {
  if (!company.landingConfig) {
    throw new HttpError(500, 'LandingConfig nao carregada.', 'LANDING_CONFIG_MISSING');
  }

  return {
    company: {
      id: company.id,
      name: company.name,
      publicSlug: company.publicSlug,
      fallbackAffiliateUrl: company.fallbackAffiliateUrl
    },
    landingConfig: {
      id: company.landingConfig.id,
      companyId: company.landingConfig.companyId,
      bannerText: company.landingConfig.bannerText,
      bannerEmoji: company.landingConfig.bannerEmoji,
      heroTitle: company.landingConfig.heroTitle,
      heroSubtitle: company.landingConfig.heroSubtitle,
      howItWorksSteps: toSteps(company.landingConfig.howItWorksSteps),
      primaryColor: company.landingConfig.primaryColor,
      logoUrl: company.landingConfig.logoUrl,
      isActive: company.landingConfig.isActive,
      updatedAt: company.landingConfig.updatedAt.toISOString()
    }
  };
};

export {
  getLandingConfig,
  updateCompanyFallbackAffiliateUrl,
  updateCompanyPublicSlug,
  updateLandingConfig,
  updateUserPublicSlug
};
export type { AccessScope, LandingConfigOutput, UpdateLandingConfigInput };
