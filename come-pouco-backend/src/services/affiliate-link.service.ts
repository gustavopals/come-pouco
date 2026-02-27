import { Prisma } from '@prisma/client';

import prisma from '../config/prisma';
import HttpError from '../utils/httpError';

interface AffiliateLinkRecord {
  id: number;
  originalLink: string;
  productImage: string;
  catchyPhrase: string;
  affiliateLink: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AffiliateLinkOutput {
  id: number;
  originalLink: string;
  productImage: string;
  catchyPhrase: string;
  affiliateLink: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateAffiliateLinkInput {
  originalLink: string;
  productImage: string;
  catchyPhrase: string;
  affiliateLink: string;
}

interface UpdateAffiliateLinkInput {
  originalLink?: string;
  productImage?: string;
  catchyPhrase?: string;
  affiliateLink?: string;
}

const toAffiliateLinkOutput = (link: AffiliateLinkRecord): AffiliateLinkOutput => ({
  id: link.id,
  originalLink: link.originalLink,
  productImage: link.productImage,
  catchyPhrase: link.catchyPhrase,
  affiliateLink: link.affiliateLink,
  createdAt: link.createdAt.toISOString(),
  updatedAt: link.updatedAt.toISOString()
});

const mapPrismaError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    throw new HttpError(404, 'Link de afiliado não encontrado.');
  }

  throw error;
};

const listAffiliateLinks = async (): Promise<AffiliateLinkOutput[]> => {
  const links = await prisma.affiliateLink.findMany({
    orderBy: { id: 'desc' },
    select: {
      id: true,
      originalLink: true,
      productImage: true,
      catchyPhrase: true,
      affiliateLink: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return links.map(toAffiliateLinkOutput);
};

const createAffiliateLink = async ({
  originalLink,
  productImage,
  catchyPhrase,
  affiliateLink
}: CreateAffiliateLinkInput): Promise<AffiliateLinkOutput> => {
  const link = await prisma.affiliateLink.create({
    data: {
      originalLink: originalLink.trim(),
      productImage: productImage.trim(),
      catchyPhrase: catchyPhrase.trim(),
      affiliateLink: affiliateLink.trim()
    },
    select: {
      id: true,
      originalLink: true,
      productImage: true,
      catchyPhrase: true,
      affiliateLink: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return toAffiliateLinkOutput(link);
};

const updateAffiliateLink = async (
  id: number,
  { originalLink, productImage, catchyPhrase, affiliateLink }: UpdateAffiliateLinkInput
): Promise<AffiliateLinkOutput> => {
  const updateData: Prisma.AffiliateLinkUpdateInput = {};

  if (originalLink !== undefined) {
    updateData.originalLink = originalLink.trim();
  }

  if (productImage !== undefined) {
    updateData.productImage = productImage.trim();
  }

  if (catchyPhrase !== undefined) {
    updateData.catchyPhrase = catchyPhrase.trim();
  }

  if (affiliateLink !== undefined) {
    updateData.affiliateLink = affiliateLink.trim();
  }

  if (!Object.keys(updateData).length) {
    throw new HttpError(400, 'Informe ao menos um campo para atualização.');
  }

  try {
    const link = await prisma.affiliateLink.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        originalLink: true,
        productImage: true,
        catchyPhrase: true,
        affiliateLink: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return toAffiliateLinkOutput(link);
  } catch (error) {
    return mapPrismaError(error);
  }
};

const deleteAffiliateLink = async (id: number): Promise<void> => {
  try {
    await prisma.affiliateLink.delete({ where: { id } });
  } catch (error) {
    return mapPrismaError(error);
  }
};

export { createAffiliateLink, deleteAffiliateLink, listAffiliateLinks, updateAffiliateLink };
