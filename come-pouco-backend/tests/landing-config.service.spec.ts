import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    company: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    landingConfig: {
      create: vi.fn(),
      upsert: vi.fn()
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock('../src/config/prisma', () => ({
  default: mocks.prisma
}));

import {
  updateCompanyPublicSlug,
  updateUserPublicSlug
} from '../src/services/landing-config.service';

const baseCompany = {
  id: 1,
  name: 'Empresa Um',
  publicSlug: 'empresa-um',
  fallbackAffiliateUrl: 'https://shopee.com.br/product/1/2',
  landingConfig: {
    id: 10,
    companyId: 1,
    bannerText: 'Banner',
    bannerEmoji: 'OK',
    heroTitle: 'Hero',
    heroSubtitle: 'Sub',
    howItWorksSteps: ['Um'],
    primaryColor: '#10b981',
    logoUrl: null,
    isActive: false,
    updatedAt: new Date('2026-05-21T10:00:00.000Z')
  }
};

describe('landing-config service permissions and slug validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a company public slug already used by another company', async () => {
    mocks.prisma.company.findUnique.mockResolvedValueOnce(baseCompany);
    mocks.prisma.company.findFirst.mockResolvedValueOnce({ id: 2 });

    await expect(
      updateCompanyPublicSlug(1, 'Empresa Dois', {
        requesterRole: 'ADMIN',
        requesterCompanyId: null,
        requesterCompanyRole: null
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      errorCode: 'PUBLIC_COMPANY_SLUG_TAKEN'
    });

    expect(mocks.prisma.company.update).not.toHaveBeenCalled();
  });

  it('rejects OWNER editing an employee public slug from another company', async () => {
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: 22,
      fullName: 'Funcionario Externo',
      username: 'externo',
      email: null,
      role: 'USER',
      companyId: 2,
      companyRole: 'EMPLOYEE',
      publicSlug: 'externo',
      twoFactorEnabled: false,
      createdAt: new Date('2026-05-21T10:00:00.000Z')
    });

    await expect(
      updateUserPublicSlug(22, 'novo-slug', {
        requesterRole: 'USER',
        requesterCompanyId: 1,
        requesterCompanyRole: 'OWNER'
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      errorCode: 'PUBLIC_USER_SLUG_FORBIDDEN'
    });

    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });
});
