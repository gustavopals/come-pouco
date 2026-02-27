import { Prisma } from '@prisma/client';

import prisma from '../config/prisma';
import HttpError from '../utils/httpError';

interface PurchasePlatformRecord {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  apiLink: string;
  accessKey: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PurchasePlatformOutput {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  apiLink: string;
  accessKey: string;
  createdAt: string;
  updatedAt: string;
}

interface CreatePurchasePlatformInput {
  name: string;
  description: string;
  isActive: boolean;
  apiLink: string;
  accessKey: string;
}

interface UpdatePurchasePlatformInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  apiLink?: string;
  accessKey?: string;
}

const toPurchasePlatformOutput = (platform: PurchasePlatformRecord): PurchasePlatformOutput => ({
  id: platform.id,
  name: platform.name,
  description: platform.description,
  isActive: platform.isActive,
  apiLink: platform.apiLink,
  accessKey: platform.accessKey,
  createdAt: platform.createdAt.toISOString(),
  updatedAt: platform.updatedAt.toISOString()
});

const mapPrismaError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    throw new HttpError(404, 'Plataforma de compras não encontrada.');
  }

  throw error;
};

const listPurchasePlatforms = async (): Promise<PurchasePlatformOutput[]> => {
  const platforms = await prisma.purchasePlatform.findMany({
    orderBy: { id: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      apiLink: true,
      accessKey: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return platforms.map(toPurchasePlatformOutput);
};

const createPurchasePlatform = async ({
  name,
  description,
  isActive,
  apiLink,
  accessKey
}: CreatePurchasePlatformInput): Promise<PurchasePlatformOutput> => {
  const platform = await prisma.purchasePlatform.create({
    data: {
      name: name.trim(),
      description: description.trim(),
      isActive,
      apiLink: apiLink.trim(),
      accessKey: accessKey.trim()
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      apiLink: true,
      accessKey: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return toPurchasePlatformOutput(platform);
};

const updatePurchasePlatform = async (
  id: number,
  { name, description, isActive, apiLink, accessKey }: UpdatePurchasePlatformInput
): Promise<PurchasePlatformOutput> => {
  const updateData: Prisma.PurchasePlatformUpdateInput = {};

  if (name !== undefined) {
    updateData.name = name.trim();
  }

  if (description !== undefined) {
    updateData.description = description.trim();
  }

  if (isActive !== undefined) {
    updateData.isActive = isActive;
  }

  if (apiLink !== undefined) {
    updateData.apiLink = apiLink.trim();
  }

  if (accessKey !== undefined) {
    updateData.accessKey = accessKey.trim();
  }

  if (!Object.keys(updateData).length) {
    throw new HttpError(400, 'Informe ao menos um campo para atualização.');
  }

  try {
    const platform = await prisma.purchasePlatform.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        apiLink: true,
        accessKey: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return toPurchasePlatformOutput(platform);
  } catch (error) {
    return mapPrismaError(error);
  }
};

const deletePurchasePlatform = async (id: number): Promise<void> => {
  try {
    await prisma.purchasePlatform.delete({ where: { id } });
  } catch (error) {
    return mapPrismaError(error);
  }
};

export { createPurchasePlatform, deletePurchasePlatform, listPurchasePlatforms, updatePurchasePlatform };
