import crypto from 'node:crypto';

import { CompanyRole, PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  canReachIntegrationDatabase,
  createIntegrationTestApp,
  shouldRunIntegrationTests,
  type IntegrationTestAppContext
} from '../helpers/integration-test-app';
import { createRequest, type TestRequest } from '../helpers/request';

interface SeedData {
  companyId: number;
  platformId: number;
  adminId: number;
  ownerId: number;
  employeeId: number;
  otherEmployeeId: number;
  twoFactorUserId: number;
  ownerToken: string;
  employeeToken: string;
  adminToken: string;
  twoFactorSecret: string;
}

const describeIntegration = describe.skipIf(!shouldRunIntegrationTests());
const jwtSecret = 'integration-jwt-secret-change-me';

let context: IntegrationTestAppContext | undefined;
let http: TestRequest;
let seed: SeedData;

describeIntegration('backend integration routes', () => {
  beforeAll(async () => {
    const databaseAvailable = await canReachIntegrationDatabase();

    if (!databaseAvailable) {
      throw new Error(
        'Postgres de integracao indisponivel. Defina TEST_DATABASE_URL/DATABASE_URL e rode `npm run test:integration`.'
      );
    }

    context = await createIntegrationTestApp();
    http = createRequest(context.app);
    seed = await seedDatabase(context.prisma);
  }, 120_000);

  afterAll(async () => {
    await context?.cleanup();
  });

  it('authenticates login flows, including wrong password, 2FA and password reset', async () => {
    const loginResponse = await http
      .post('/api/auth/login')
      .send({ identifier: 'owner', password: 'SenhaForte123' })
      .expect(200);

    expect(loginResponse.body).toMatchObject({
      token: expect.any(String),
      user: {
        username: 'owner',
        companyId: seed.companyId,
        companyRole: CompanyRole.OWNER
      }
    });

    await http
      .post('/api/auth/login')
      .send({ identifier: 'owner', password: 'senha-errada' })
      .expect(401);

    const challengeResponse = await http
      .post('/api/auth/login')
      .send({ identifier: 'twofa', password: 'SenhaForte123' })
      .expect(200);

    expect(challengeResponse.body).toMatchObject({
      twoFactorRequired: true,
      requires2fa: true,
      tempToken: expect.any(String)
    });

    await http
      .post('/api/auth/login/2fa')
      .send({ tempToken: challengeResponse.body.tempToken, code: '000000' })
      .expect(400);

    const totpCode = generateTotp(seed.twoFactorSecret);
    const twoFactorResponse = await http
      .post('/api/auth/login/2fa')
      .send({ tempToken: challengeResponse.body.tempToken, code: totpCode, trustDevice: true })
      .expect(200);

    expect(twoFactorResponse.body).toMatchObject({
      token: expect.any(String),
      user: {
        id: seed.twoFactorUserId,
        twoFactorEnabled: true
      }
    });
    const setCookieHeader = twoFactorResponse.headers['set-cookie'];
    const setCookieText = Array.isArray(setCookieHeader)
      ? setCookieHeader.join(';')
      : String(setCookieHeader ?? '');
    expect(setCookieText).toContain('cp_td=');

    const expiredTempToken = jwt.sign(
      {
        sub: seed.twoFactorUserId,
        purpose: '2fa_pending',
        exp: Math.floor(Date.now() / 1000) - 60
      },
      jwtSecret
    );

    await http
      .post('/api/auth/login/2fa')
      .send({ tempToken: expiredTempToken, code: totpCode })
      .expect(401);

    const resetToken = `reset-${crypto.randomBytes(24).toString('hex')}`;
    await context!.prisma.passwordResetToken.create({
      data: {
        userId: seed.employeeId,
        tokenHash: sha256(resetToken),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    await http
      .post('/api/auth/reset-password')
      .send({ token: resetToken, newPassword: 'NovaSenha987' })
      .expect(200);

    await http
      .post('/api/auth/login')
      .send({ identifier: 'employee', password: 'NovaSenha987' })
      .expect(200);
  });

  it('generates Shopee shortlinks in MOCK mode through authenticated integration route', async () => {
    const response = await http
      .post('/api/integrations/shopee/generate-shortlinks')
      .set('Authorization', `Bearer ${seed.ownerToken}`)
      .send({
        originUrls: [
          'https://shopee.com.br/product/123/456',
          'https://shopee.com.br/fone-bluetooth-i.321.654'
        ],
        subId1: 'campanha'
      })
      .expect(200);

    expect(response.body.results).toHaveLength(2);
    expect(response.body.results[0]).toMatchObject({
      originUrl: 'https://shopee.com.br/product/123/456',
      success: true,
      shortLink: expect.stringMatching(/^https:\/\/shopee\.mock\/s\//)
    });

    const usageCount = await context!.prisma.apiRequestLog.count({
      where: {
        companyId: seed.companyId,
        userId: seed.ownerId,
        platformId: seed.platformId,
        mode: 'MOCK'
      }
    });

    expect(usageCount).toBe(2);
  });

  it('lists affiliate links with server-side pagination and role-based visibility', async () => {
    const employeeResponse = await http
      .get('/api/affiliate-links?page=1&limit=10')
      .set('Authorization', `Bearer ${seed.employeeToken}`)
      .expect(200);

    expect(employeeResponse.body.meta.total).toBe(1);
    expect(employeeResponse.body.items).toEqual([
      expect.objectContaining({
        createdByUserId: seed.employeeId,
        companyId: seed.companyId
      })
    ]);

    const ownerResponse = await http
      .get('/api/affiliate-links?page=1&limit=10')
      .set('Authorization', `Bearer ${seed.ownerToken}`)
      .expect(200);

    expect(ownerResponse.body.meta.total).toBe(2);

    const adminFilteredResponse = await http
      .get(`/api/affiliate-links?page=1&limit=10&companyId=${seed.companyId}&search=owner-visible`)
      .set('Authorization', `Bearer ${seed.adminToken}`)
      .expect(200);

    expect(adminFilteredResponse.body.meta.total).toBe(1);
    expect(adminFilteredResponse.body.items[0].subId1).toBe('owner-visible');
  });

  it('handles public landing conversion success, missing slug and honeypot bot detection', async () => {
    await http.get('/api/public/landing/acme-integracao').expect(200);

    const successResponse = await http
      .post('/api/public/convert')
      .send({
        url: 'https://shopee.com.br/product/111/222',
        companySlug: 'acme-integracao',
        employeeSlug: 'employee'
      })
      .expect(200);

    expect(successResponse.body).toMatchObject({
      status: 'success',
      affiliateUrl: expect.stringMatching(/^https:\/\/shopee\.mock\/s\//),
      conversionId: expect.any(String)
    });

    const missingResponse = await http
      .post('/api/public/convert')
      .send({
        url: 'https://shopee.com.br/product/111/222',
        companySlug: 'slug-inexistente'
      })
      .expect(404);

    expect(missingResponse.body).toMatchObject({
      status: 'error',
      errorCode: expect.any(String)
    });

    const honeypotResponse = await http
      .post('/api/public/convert')
      .send({
        url: 'https://shopee.com.br/product/111/222',
        companySlug: 'acme-integracao',
        website: 'bot-field'
      })
      .expect(200);

    expect(honeypotResponse.body).toMatchObject({
      status: 'success',
      affiliateUrl: expect.any(String)
    });

    const botConversions = await context!.prisma.conversion.count({
      where: {
        companyId: seed.companyId,
        status: 'BOT_DETECTED'
      }
    });

    expect(botConversions).toBe(1);
  });

  it('creates public leads and enforces the public lead rate limit', async () => {
    const firstLead = await http
      .post('/api/public/leads')
      .send({
        name: 'Lead Teste',
        email: 'lead-0@test.local',
        volume: '100 links/mes',
        message: 'Quero conhecer.'
      })
      .expect(201);

    expect(firstLead.body).toMatchObject({ ok: true, id: expect.any(Number) });

    for (let index = 1; index < 10; index += 1) {
      await http
        .post('/api/public/leads')
        .send({
          name: `Lead Teste ${index}`,
          email: `lead-${index}@test.local`
        })
        .expect(201);
    }

    await http
      .post('/api/public/leads')
      .send({
        name: 'Lead Bloqueado',
        email: 'lead-10@test.local'
      })
      .expect(429);

    await flushPendingTasks();
  });
});

const seedDatabase = async (prisma: PrismaClient): Promise<SeedData> => {
  const { encryptValue } = await import('../../src/utils/crypto');
  const passwordHash = await bcrypt.hash('SenhaForte123', 10);
  const twoFactorSecret = 'JBSWY3DPEHPK3PXP';

  const platform = await prisma.purchasePlatform.create({
    data: {
      name: 'Shopee Mock Integracao',
      description: 'Plataforma mock para testes de integracao',
      type: 'SHOPEE',
      appId: 'integration-app-id',
      secret: 'integration-secret',
      apiUrl: 'https://open-api.affiliate.shopee.com.br/graphql',
      isActive: true,
      mockMode: true,
      apiLink: 'https://open-api.affiliate.shopee.com.br/graphql',
      accessKey: ''
    }
  });

  const company = await prisma.company.create({
    data: {
      name: 'Acme Integracao',
      publicSlug: 'acme-integracao',
      fallbackAffiliateUrl: 'https://shopee.com.br/fallback-acme',
      shopeePlatformId: platform.id,
      shopeeMode: 'TEST',
      landingConfig: {
        create: {
          isActive: true,
          bannerText: 'Ofertas Acme',
          bannerEmoji: 'bag',
          heroTitle: 'Compre com a Acme',
          heroSubtitle: 'Links Shopee rastreados.',
          howItWorksSteps: ['Cole', 'Converta', 'Compre'],
          primaryColor: '#10b981'
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

  const admin = await prisma.user.create({
    data: {
      fullName: 'Admin Integracao',
      username: 'admin-integration',
      email: 'admin.integration@test.local',
      passwordHash,
      role: UserRole.ADMIN
    }
  });

  const owner = await prisma.user.create({
    data: {
      fullName: 'Owner Integracao',
      username: 'owner',
      email: 'owner@test.local',
      passwordHash,
      role: UserRole.USER,
      companyId: company.id,
      companyRole: CompanyRole.OWNER,
      publicSlug: 'owner'
    }
  });

  const employee = await prisma.user.create({
    data: {
      fullName: 'Employee Integracao',
      username: 'employee',
      email: 'employee@test.local',
      passwordHash,
      role: UserRole.USER,
      companyId: company.id,
      companyRole: CompanyRole.EMPLOYEE,
      publicSlug: 'employee'
    }
  });

  const otherEmployee = await prisma.user.create({
    data: {
      fullName: 'Other Employee Integracao',
      username: 'other-employee',
      email: 'other.employee@test.local',
      passwordHash,
      role: UserRole.USER,
      companyId: company.id,
      companyRole: CompanyRole.EMPLOYEE,
      publicSlug: 'other'
    }
  });

  const twoFactorUser = await prisma.user.create({
    data: {
      fullName: 'Two Factor Integracao',
      username: 'twofa',
      email: 'twofa@test.local',
      passwordHash,
      role: UserRole.USER,
      companyId: company.id,
      companyRole: CompanyRole.EMPLOYEE,
      publicSlug: 'twofa',
      twoFactorEnabled: true,
      twoFactorSecret: encryptValue(twoFactorSecret),
      twoFactorConfirmedAt: new Date()
    }
  });

  await prisma.affiliateLink.createMany({
    data: [
      {
        originalLink: 'https://shopee.com.br/product/1/100',
        subId1: 'employee-visible',
        productImage: 'https://example.test/product-100.jpg',
        catchyPhrase: 'Oferta do employee',
        affiliateLink: 'https://s.shopee.com.br/employee',
        companyId: company.id,
        createdByUserId: employee.id
      },
      {
        originalLink: 'https://shopee.com.br/product/1/200',
        subId1: 'owner-visible',
        productImage: 'https://example.test/product-200.jpg',
        catchyPhrase: 'Oferta de outro employee',
        affiliateLink: 'https://s.shopee.com.br/other',
        companyId: company.id,
        createdByUserId: otherEmployee.id
      }
    ]
  });

  return {
    companyId: company.id,
    platformId: platform.id,
    adminId: admin.id,
    ownerId: owner.id,
    employeeId: employee.id,
    otherEmployeeId: otherEmployee.id,
    twoFactorUserId: twoFactorUser.id,
    ownerToken: signAuthToken(owner.id),
    employeeToken: signAuthToken(employee.id),
    adminToken: signAuthToken(admin.id),
    twoFactorSecret
  };
};

const signAuthToken = (userId: number): string =>
  jwt.sign({ sub: userId, authIssuedAt: Date.now() }, jwtSecret, { expiresIn: '1h' });

const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

const flushPendingTasks = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 25));
};

const normalizeBase32 = (value: string): string =>
  value.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');

const base32ToBuffer = (base32: string): Buffer => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = normalizeBase32(base32);
  let bits = '';

  for (const char of normalized) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let cursor = 0; cursor + 8 <= bits.length; cursor += 8) {
    bytes.push(parseInt(bits.slice(cursor, cursor + 8), 2));
  }

  return Buffer.from(bytes);
};

const generateTotp = (secret: string, now = Date.now()): string => {
  const counter = Math.floor(Math.floor(now / 1000) / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter % 0x100000000, 4);

  const hmac = crypto.createHmac('sha1', base32ToBuffer(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binaryCode % 1_000_000).toString().padStart(6, '0');
};
