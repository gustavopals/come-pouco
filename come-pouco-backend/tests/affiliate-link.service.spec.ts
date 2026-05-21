import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    affiliateLink: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}));

vi.mock('../src/config/prisma', () => ({
  default: mocks.prisma
}));

import {
  createAffiliateLinks,
  deleteAffiliateLinks,
  listAffiliateLinks,
  updateAffiliateLink,
  type RequestScope
} from '../src/services/affiliate-link.service';

const now = new Date('2026-05-21T10:00:00.000Z');

const makeLink = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  originalLink: 'https://shopee.com.br/product/1/2',
  subId1: 'creator',
  productImage: 'https://example.test/image.jpg',
  catchyPhrase: 'Oferta testada',
  affiliateLink: 'https://s.shopee.com.br/abc',
  companyId: 10,
  createdByUserId: 7,
  createdByUser: {
    id: 7,
    fullName: 'Ana Creator',
    email: 'ana@test.local'
  },
  createdAt: now,
  updatedAt: now,
  ...overrides
});

const adminScope: RequestScope = {
  requesterUserId: 1,
  requesterRole: 'ADMIN',
  requesterCompanyId: null,
  requesterCompanyRole: null
};

const ownerScope: RequestScope = {
  requesterUserId: 2,
  requesterRole: 'USER',
  requesterCompanyId: 10,
  requesterCompanyRole: 'OWNER'
};

const employeeScope: RequestScope = {
  requesterUserId: 7,
  requesterRole: 'USER',
  requesterCompanyId: 10,
  requesterCompanyRole: 'EMPLOYEE'
};

describe('affiliate-link.service', () => {
  beforeEach(() => {
    mocks.prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }

      if (typeof input === 'function') {
        return input(mocks.prisma);
      }

      return input;
    });

    mocks.prisma.affiliateLink.count.mockResolvedValue(1);
    mocks.prisma.affiliateLink.findMany.mockResolvedValue([makeLink()]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lists only employee-owned links for EMPLOYEE users', async () => {
    const result = await listAffiliateLinks({
      ...employeeScope,
      pagination: { page: 1, limit: 20 }
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 1,
      createdAt: now.toISOString(),
      createdByUser: { fullName: 'Ana Creator' }
    });
    expect(mocks.prisma.affiliateLink.count).toHaveBeenCalledWith({
      where: { companyId: 10, createdByUserId: 7 }
    });
    expect(mocks.prisma.affiliateLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 10, createdByUserId: 7 },
        skip: 0,
        take: 20
      })
    );
  });

  it('lets OWNER list company links with creator and date filters applied server-side', async () => {
    const startDate = new Date('2026-05-01T00:00:00.000Z');
    const endDate = new Date('2026-05-21T23:59:59.000Z');

    await listAffiliateLinks({
      ...ownerScope,
      createdByUserIdFilter: 8,
      search: 'ana@test.local',
      startDate,
      endDate,
      pagination: { page: 2, limit: 10 }
    });

    expect(mocks.prisma.affiliateLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { companyId: 10 },
            expect.objectContaining({ OR: expect.any(Array) }),
            { createdByUserId: 8 },
            { createdAt: { gte: startDate, lte: endDate } }
          ]
        },
        skip: 10,
        take: 10
      })
    );
  });

  it('lets ADMIN list all links or narrow by company', async () => {
    await listAffiliateLinks({
      ...adminScope,
      companyIdFilter: 33,
      pagination: { page: 1, limit: 5 }
    });

    expect(mocks.prisma.affiliateLink.count).toHaveBeenCalledWith({
      where: { companyId: 33 }
    });
  });

  it('rejects list access when a regular user has no company', async () => {
    await expect(
      listAffiliateLinks({
        requesterUserId: 9,
        requesterRole: 'USER',
        requesterCompanyId: null,
        requesterCompanyRole: 'EMPLOYEE'
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('creates links using the requester company for non-admin users', async () => {
    mocks.prisma.affiliateLink.create
      .mockResolvedValueOnce(
        makeLink({ id: 11, originalLink: 'https://shopee.com.br/product/1/11' })
      )
      .mockResolvedValueOnce(
        makeLink({ id: 12, originalLink: 'https://shopee.com.br/product/1/12' })
      );

    const created = await createAffiliateLinks(
      {
        originalLinks: [
          ' https://shopee.com.br/product/1/11 ',
          ' https://shopee.com.br/product/1/12 '
        ],
        subId1: ' campaign ',
        productImage: ' https://example.test/p.jpg ',
        catchyPhrase: ' Oferta ',
        affiliateLink: ' https://s.shopee.com.br/same ',
        companyId: 999
      },
      employeeScope
    );

    expect(created.map((link) => link.id)).toEqual([11, 12]);
    expect(mocks.prisma.affiliateLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalLink: 'https://shopee.com.br/product/1/11',
          subId1: 'campaign',
          productImage: 'https://example.test/p.jpg',
          catchyPhrase: 'Oferta',
          affiliateLink: 'https://s.shopee.com.br/same',
          companyId: 10,
          createdByUserId: 7
        })
      })
    );
  });

  it('prevents EMPLOYEE from updating links created by another user', async () => {
    mocks.prisma.affiliateLink.findUnique.mockResolvedValue({ companyId: 10, createdByUserId: 99 });

    await expect(
      updateAffiliateLink(1, { catchyPhrase: 'Nova frase' }, employeeScope)
    ).rejects.toMatchObject({
      statusCode: 403
    });
    expect(mocks.prisma.affiliateLink.update).not.toHaveBeenCalled();
  });

  it('updates allowed links and rejects empty updates', async () => {
    mocks.prisma.affiliateLink.findUnique.mockResolvedValue({ companyId: 10, createdByUserId: 7 });
    mocks.prisma.affiliateLink.update.mockResolvedValue(makeLink({ catchyPhrase: 'Nova frase' }));

    await expect(updateAffiliateLink(1, {}, employeeScope)).rejects.toMatchObject({
      statusCode: 400
    });

    const updated = await updateAffiliateLink(1, { catchyPhrase: ' Nova frase ' }, employeeScope);

    expect(updated.catchyPhrase).toBe('Nova frase');
    expect(mocks.prisma.affiliateLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { catchyPhrase: 'Nova frase' }
      })
    );
  });

  it('bulk deletes only the links visible to the requester scope', async () => {
    mocks.prisma.affiliateLink.deleteMany.mockResolvedValue({ count: 4 });

    const deleted = await deleteAffiliateLinks(employeeScope);

    expect(deleted).toBe(4);
    expect(mocks.prisma.affiliateLink.deleteMany).toHaveBeenCalledWith({
      where: { companyId: 10, createdByUserId: 7 }
    });
  });
});
