import { Prisma } from '@prisma/client';

import prisma from '../config/prisma';
import {
  PUBLIC_SLUG_MAX_LENGTH,
  PUBLIC_SLUG_MIN_LENGTH,
  PUBLIC_SLUG_PATTERN,
  isReservedPublicSlug,
  slugifyPublicSlug
} from '../config/reserved-slugs';
import HttpError from '../utils/httpError';

interface NormalizePublicSlugOptions {
  nullable?: boolean;
}

const normalizePublicSlugInput = (
  value: string | null | undefined,
  options: NormalizePublicSlugOptions = {}
): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value.trim() === '') {
    if (options.nullable) {
      return null;
    }

    throw new HttpError(400, 'Slug publico e obrigatorio.', 'PUBLIC_SLUG_REQUIRED');
  }

  const normalized = slugifyPublicSlug(value);

  if (normalized.length < PUBLIC_SLUG_MIN_LENGTH || normalized.length > PUBLIC_SLUG_MAX_LENGTH) {
    throw new HttpError(
      400,
      `Slug publico deve ter entre ${PUBLIC_SLUG_MIN_LENGTH} e ${PUBLIC_SLUG_MAX_LENGTH} caracteres.`,
      'PUBLIC_SLUG_INVALID_LENGTH'
    );
  }

  if (!PUBLIC_SLUG_PATTERN.test(normalized)) {
    throw new HttpError(
      400,
      'Slug publico invalido. Use letras, numeros e hifens.',
      'PUBLIC_SLUG_INVALID_FORMAT'
    );
  }

  if (isReservedPublicSlug(normalized)) {
    throw new HttpError(400, 'Slug publico reservado.', 'PUBLIC_SLUG_RESERVED');
  }

  return normalized;
};

const assertCompanyPublicSlugAvailable = async (
  publicSlug: string | null | undefined,
  currentCompanyId?: number
): Promise<void> => {
  if (!publicSlug) {
    return;
  }

  const existing = await prisma.company.findFirst({
    where: {
      publicSlug,
      id: currentCompanyId ? { not: currentCompanyId } : undefined
    },
    select: { id: true }
  });

  if (existing) {
    throw new HttpError(
      409,
      'Ja existe uma empresa com esse slug publico.',
      'PUBLIC_COMPANY_SLUG_TAKEN'
    );
  }
};

const assertUserPublicSlugAvailable = async (
  companyId: number,
  publicSlug: string | null | undefined,
  currentUserId?: number
): Promise<void> => {
  if (!publicSlug) {
    return;
  }

  const existing = await prisma.user.findFirst({
    where: {
      companyId,
      publicSlug,
      id: currentUserId ? { not: currentUserId } : undefined
    },
    select: { id: true }
  });

  if (existing) {
    throw new HttpError(
      409,
      'Ja existe um usuario com esse slug publico nesta empresa.',
      'PUBLIC_USER_SLUG_TAKEN'
    );
  }
};

const mapPublicSlugPrismaError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : '';

    if (target.includes('public_slug')) {
      throw new HttpError(409, 'Slug publico ja esta em uso.', 'PUBLIC_SLUG_TAKEN');
    }
  }

  throw error;
};

export {
  assertCompanyPublicSlugAvailable,
  assertUserPublicSlugAvailable,
  mapPublicSlugPrismaError,
  normalizePublicSlugInput
};
