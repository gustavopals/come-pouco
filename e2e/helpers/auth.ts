import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';

import { APIRequestContext, Page, expect } from '@playwright/test';
import { generateSecret, generateSync } from 'otplib';

import { e2eConfig } from './config';
import { encryptSecret, encryptValue } from './crypto';
import { getPrisma } from './db';

const requireFromBackend = createRequire(
  path.join(process.cwd(), 'come-pouco-backend', 'package.json')
);
const bcrypt = requireFromBackend('bcryptjs') as {
  hash(value: string, rounds: number): Promise<string>;
};

type AuthUser = {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  role: 'ADMIN' | 'USER';
  companyId: number | null;
  companyRole: 'OWNER' | 'EMPLOYEE' | null;
  company: {
    id: number;
    name: string;
    shopeeMode: 'TEST' | 'PROD';
    isShopeeConfiguredForMode: boolean;
  } | null;
  twoFactorEnabled: boolean;
  twoFactorConfirmedAt: string | null;
};

type AuthSession = {
  token: string;
  user: AuthUser;
};

type LoginStartResponse =
  | AuthSession
  | {
      tempToken?: string;
      challengeId?: string;
      requires2fa?: boolean;
    };

type E2EScenario = {
  suffix: string;
  password: string;
  companyId: number;
  companyName: string;
  companySlug: string;
  platformId: number;
  userId: number;
  username: string;
  email: string;
  totpSecret: string | null;
};

const e2eShopeeProductUrls = [
  'https://shopee.com.br/product/10001/20001',
  'https://shopee.com.br/product/10001/20002',
  'https://shopee.com.br/product/10001/20003',
  'https://shopee.com.br/product/10001/20004',
  'https://shopee.com.br/product/10001/20005'
];

const randomSuffix = (): string => crypto.randomUUID().slice(0, 8);

const seedOwnerScenario = async (options: { twoFactor?: boolean } = {}): Promise<E2EScenario> => {
  const prisma = getPrisma();
  const suffix = randomSuffix();
  const password = e2eConfig.defaultPassword;
  const passwordHash = await bcrypt.hash(password, 10);
  const companySlug = `e2e-${suffix}`;
  const username = `e2e-${suffix}`;
  const email = `e2e-${suffix}@test.local`;
  const totpSecret = options.twoFactor ? generateSecret() : null;

  const platform = await prisma.purchasePlatform.create({
    data: {
      name: `E2E Shopee ${suffix}`,
      description: 'Plataforma mock criada pela suite E2E',
      type: 'SHOPEE',
      appId: `e2e-app-${suffix}`,
      secret: encryptSecret(`e2e-secret-${suffix}`),
      isActive: true,
      mockMode: true,
      apiUrl: 'https://shopee.mock/graphql',
      apiLink: 'https://shopee.mock/graphql',
      accessKey: encryptSecret(`e2e-access-${suffix}`)
    }
  });

  const company = await prisma.company.create({
    data: {
      name: `E2E Company ${suffix}`,
      historyRetentionDays: 30,
      shopeeMode: 'TEST',
      publicSlug: companySlug,
      fallbackAffiliateUrl: 'https://shopee.mock/fallback',
      shopeePlatform: { connect: { id: platform.id } },
      shopeePlatformTest: { connect: { id: platform.id } },
      landingConfig: {
        create: {
          bannerText: 'Ofertas E2E',
          bannerEmoji: 'OK',
          heroTitle: 'Landing E2E de ofertas Shopee',
          heroSubtitle: 'Cole um link da Shopee para preparar seu cupom.',
          howItWorksSteps: ['Cole um link Shopee', 'Geramos seu link', 'Abra a oferta'],
          primaryColor: '#10b981',
          isActive: true
        }
      }
    }
  });

  await prisma.companyPlatform.create({
    data: {
      companyId: company.id,
      platformId: platform.id,
      isDefaultForCompany: true
    }
  });

  const user = await prisma.user.create({
    data: {
      fullName: `E2E Owner ${suffix}`,
      username,
      email,
      passwordHash,
      role: 'USER',
      companyId: company.id,
      companyRole: 'OWNER',
      publicSlug: `owner-${suffix}`,
      twoFactorEnabled: Boolean(totpSecret),
      twoFactorSecret: totpSecret ? encryptValue(totpSecret) : null,
      twoFactorConfirmedAt: totpSecret ? new Date() : null
    }
  });

  return {
    suffix,
    password,
    companyId: company.id,
    companyName: company.name,
    companySlug,
    platformId: platform.id,
    userId: user.id,
    username,
    email,
    totpSecret
  };
};

const cleanupScenario = async (scenario: E2EScenario): Promise<void> => {
  const prisma = getPrisma();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: scenario.userId } }),
    prisma.trustedDevice.deleteMany({ where: { userId: scenario.userId } }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId: scenario.userId } }),
    prisma.auditLog.deleteMany({ where: { userId: scenario.userId } }),
    prisma.apiRequestLog.deleteMany({
      where: {
        OR: [
          { companyId: scenario.companyId },
          { userId: scenario.userId },
          { platformId: scenario.platformId }
        ]
      }
    }),
    prisma.conversion.deleteMany({ where: { companyId: scenario.companyId } }),
    prisma.affiliateLink.deleteMany({
      where: {
        OR: [{ companyId: scenario.companyId }, { createdByUserId: scenario.userId }]
      }
    }),
    prisma.companyPlatform.deleteMany({
      where: {
        OR: [{ companyId: scenario.companyId }, { platformId: scenario.platformId }]
      }
    }),
    prisma.user.deleteMany({
      where: {
        OR: [{ id: scenario.userId }, { companyId: scenario.companyId }]
      }
    }),
    prisma.landingConfig.deleteMany({ where: { companyId: scenario.companyId } }),
    prisma.company.deleteMany({ where: { id: scenario.companyId } }),
    prisma.purchasePlatform.deleteMany({ where: { id: scenario.platformId } })
  ]);
};

const loginViaApi = async (
  request: APIRequestContext,
  scenario: E2EScenario
): Promise<AuthSession> => {
  const loginResponse = await request.post(`${e2eConfig.backendURL}/api/auth/login`, {
    data: {
      identifier: scenario.email,
      password: scenario.password
    }
  });

  expect(loginResponse.ok()).toBe(true);
  const body = (await loginResponse.json()) as LoginStartResponse;

  if ('token' in body) {
    return body;
  }

  const tempToken = body.tempToken || body.challengeId;
  if (!tempToken || !scenario.totpSecret) {
    throw new Error('Login exige 2FA, mas o cenário não tem tempToken/secret.');
  }

  const twoFactorResponse = await request.post(`${e2eConfig.backendURL}/api/auth/login/2fa`, {
    data: {
      tempToken,
      code: generateSync({ secret: scenario.totpSecret })
    }
  });

  expect(twoFactorResponse.ok()).toBe(true);
  return (await twoFactorResponse.json()) as AuthSession;
};

const loginPageWithSession = async (
  page: Page,
  session: AuthSession,
  pathName = '/home'
): Promise<void> => {
  await page.addInitScript(({ token, user }) => {
    window.localStorage.setItem('come_pouco_token', token);
    window.localStorage.setItem('come_pouco_user', JSON.stringify(user));
  }, session);

  await page.goto(pathName);
};

export {
  cleanupScenario,
  e2eShopeeProductUrls,
  loginPageWithSession,
  loginViaApi,
  seedOwnerScenario
};
export type { E2EScenario };
