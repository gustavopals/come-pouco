import { Prisma } from '@prisma/client';

import prisma from '../config/prisma';
import type { CompanyRole } from '../types/company-role';
import type { UserRole } from '../types/user-role';
import HttpError from '../utils/httpError';

interface AffiliateLinkRecord {
  id: number;
  originalLink: string;
  subId1: string | null;
  productImage: string;
  catchyPhrase: string;
  affiliateLink: string;
  companyId: number | null;
  createdByUserId: number | null;
  createdByUser: {
    id: number;
    fullName: string;
    email: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AffiliateLinkOutput {
  id: number;
  originalLink: string;
  subId1: string | null;
  productImage: string;
  catchyPhrase: string;
  affiliateLink: string;
  companyId: number | null;
  createdByUserId: number | null;
  createdByUser: {
    id: number;
    fullName: string;
    email: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface RequestScope {
  requesterUserId: number;
  requesterRole: UserRole;
  requesterCompanyId: number | null;
  requesterCompanyRole: CompanyRole | null;
}

interface ListScope extends RequestScope {
  companyIdFilter?: number | null;
}

interface CreateAffiliateLinksInput {
  originalLinks: string[];
  subId1: string | null;
  productImage: string;
  catchyPhrase: string;
  affiliateLink: string;
  companyId?: number | null;
}

interface CreateAffiliateLinksFromGeneratedInput {
  generatedLinks: Array<{
    originUrl: string;
    shortLink: string;
  }>;
  subId1: string | null;
  productImage?: string;
  catchyPhrase?: string;
  companyId?: number | null;
}

interface UpdateAffiliateLinkInput {
  originalLink?: string;
  subId1?: string | null;
  productImage?: string;
  catchyPhrase?: string;
  affiliateLink?: string;
}

const toAffiliateLinkOutput = (link: AffiliateLinkRecord): AffiliateLinkOutput => ({
  id: link.id,
  originalLink: link.originalLink,
  subId1: link.subId1,
  productImage: link.productImage,
  catchyPhrase: link.catchyPhrase,
  affiliateLink: link.affiliateLink,
  companyId: link.companyId,
  createdByUserId: link.createdByUserId,
  createdByUser: link.createdByUser,
  createdAt: link.createdAt.toISOString(),
  updatedAt: link.updatedAt.toISOString()
});

const mapPrismaError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    throw new HttpError(404, 'Link de afiliado nao encontrado.');
  }

  throw error;
};

const linkSelect = {
  id: true,
  originalLink: true,
  subId1: true,
  productImage: true,
  catchyPhrase: true,
  affiliateLink: true,
  companyId: true,
  createdByUserId: true,
  createdByUser: {
    select: {
      id: true,
      fullName: true,
      email: true
    }
  },
  createdAt: true,
  updatedAt: true
} satisfies Prisma.AffiliateLinkSelect;

const resolveCompanyIdForCreate = (scope: RequestScope, companyId: number | null | undefined): number | null => {
  if (scope.requesterRole === 'ADMIN') {
    return companyId ?? null;
  }

  if (!scope.requesterCompanyId) {
    throw new HttpError(403, 'Usuario sem empresa vinculada nao pode criar links.');
  }

  return scope.requesterCompanyId;
};

const buildWhereByScope = (scope: ListScope): Prisma.AffiliateLinkWhereInput => {
  if (scope.requesterRole === 'ADMIN') {
    if (scope.companyIdFilter) {
      return { companyId: scope.companyIdFilter };
    }

    return {};
  }

  if (!scope.requesterCompanyId) {
    throw new HttpError(403, 'Usuario sem empresa vinculada.');
  }

  if (scope.requesterCompanyRole === 'OWNER') {
    return { companyId: scope.requesterCompanyId };
  }

  return { companyId: scope.requesterCompanyId, createdByUserId: scope.requesterUserId };
};

const ensureLinkPermission = async (id: number, scope: RequestScope): Promise<void> => {
  if (scope.requesterRole === 'ADMIN') {
    return;
  }

  const link = await prisma.affiliateLink.findUnique({ where: { id }, select: { companyId: true, createdByUserId: true } });

  if (!link) {
    throw new HttpError(404, 'Link de afiliado nao encontrado.');
  }

  if (!scope.requesterCompanyId || link.companyId !== scope.requesterCompanyId) {
    throw new HttpError(403, 'Acesso negado para este link.');
  }

  if (scope.requesterCompanyRole === 'OWNER') {
    return;
  }

  if (link.createdByUserId !== scope.requesterUserId) {
    throw new HttpError(403, 'Funcionario pode alterar apenas links criados por ele.');
  }
};

const listAffiliateLinks = async (scope: ListScope): Promise<AffiliateLinkOutput[]> => {
  const links = await prisma.affiliateLink.findMany({
    where: buildWhereByScope(scope),
    orderBy: { id: 'desc' },
    select: linkSelect
  });

  return links.map(toAffiliateLinkOutput);
};

const createAffiliateLinks = async (
  {
    originalLinks,
    subId1,
    productImage,
    catchyPhrase,
    affiliateLink,
    companyId
  }: CreateAffiliateLinksInput,
  scope: RequestScope
): Promise<AffiliateLinkOutput[]> => {
  const normalizedSubId1 = subId1?.trim() || null;
  const effectiveCompanyId = resolveCompanyIdForCreate(scope, companyId);

  const links = await prisma.$transaction(async (tx) => {
    const created = await Promise.all(
      originalLinks.map((originalLink) =>
        tx.affiliateLink.create({
          data: {
            originalLink: originalLink.trim(),
            subId1: normalizedSubId1,
            productImage: productImage.trim(),
            catchyPhrase: catchyPhrase.trim(),
            affiliateLink: affiliateLink.trim(),
            companyId: effectiveCompanyId,
            createdByUserId: scope.requesterUserId
          },
          select: linkSelect
        })
      )
    );

    return created;
  });

  return links.map(toAffiliateLinkOutput);
};

const createAffiliateLinksFromGenerated = async (
  { generatedLinks, subId1, productImage, catchyPhrase, companyId }: CreateAffiliateLinksFromGeneratedInput,
  scope: RequestScope
): Promise<AffiliateLinkOutput[]> => {
  const normalizedSubId1 = subId1?.trim() || null;
  const normalizedProductImage = (productImage || '').trim();
  const normalizedCatchyPhrase = (catchyPhrase || '').trim();
  const effectiveCompanyId = resolveCompanyIdForCreate(scope, companyId);

  const links = await prisma.$transaction(async (tx) => {
    const created = await Promise.all(
      generatedLinks.map((item) =>
        tx.affiliateLink.create({
          data: {
            originalLink: item.originUrl.trim(),
            subId1: normalizedSubId1,
            productImage: normalizedProductImage,
            catchyPhrase: normalizedCatchyPhrase,
            affiliateLink: item.shortLink.trim(),
            companyId: effectiveCompanyId,
            createdByUserId: scope.requesterUserId
          },
          select: linkSelect
        })
      )
    );

    return created;
  });

  return links.map(toAffiliateLinkOutput);
};

const updateAffiliateLink = async (id: number, data: UpdateAffiliateLinkInput, scope: RequestScope): Promise<AffiliateLinkOutput> => {
  await ensureLinkPermission(id, scope);

  const updateData: Prisma.AffiliateLinkUpdateInput = {};

  if (data.originalLink !== undefined) {
    updateData.originalLink = data.originalLink.trim();
  }

  if (data.subId1 !== undefined) {
    updateData.subId1 = data.subId1?.trim() || null;
  }

  if (data.productImage !== undefined) {
    updateData.productImage = data.productImage.trim();
  }

  if (data.catchyPhrase !== undefined) {
    updateData.catchyPhrase = data.catchyPhrase.trim();
  }

  if (data.affiliateLink !== undefined) {
    updateData.affiliateLink = data.affiliateLink.trim();
  }

  if (!Object.keys(updateData).length) {
    throw new HttpError(400, 'Informe ao menos um campo para atualizacao.');
  }

  try {
    const link = await prisma.affiliateLink.update({ where: { id }, data: updateData, select: linkSelect });
    return toAffiliateLinkOutput(link);
  } catch (error) {
    return mapPrismaError(error);
  }
};

const deleteAffiliateLink = async (id: number, scope: RequestScope): Promise<void> => {
  await ensureLinkPermission(id, scope);

  try {
    await prisma.affiliateLink.delete({ where: { id } });
  } catch (error) {
    return mapPrismaError(error);
  }
};

const deleteAffiliateLinks = async (scope: ListScope): Promise<number> => {
  const where = buildWhereByScope(scope);
  const result = await prisma.affiliateLink.deleteMany({ where });
  return result.count;
};

export {
  createAffiliateLinks,
  createAffiliateLinksFromGenerated,
  deleteAffiliateLink,
  deleteAffiliateLinks,
  listAffiliateLinks,
  updateAffiliateLink
};
export type { RequestScope };
