import { NextFunction, Request, Response } from 'express';

import * as affiliateLinkService from '../services/affiliate-link.service';
import HttpError from '../utils/httpError';

interface CreateAffiliateLinkBody {
  originalLink?: string;
  productImage?: string;
  catchyPhrase?: string;
  affiliateLink?: string;
}

interface UpdateAffiliateLinkBody {
  originalLink?: string;
  productImage?: string;
  catchyPhrase?: string;
  affiliateLink?: string;
}

const isValidUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const parseId = (value: string): number => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'ID inválido.');
  }

  return id;
};

const validateUrls = (payload: { originalLink?: string; productImage?: string; affiliateLink?: string }): void => {
  const { originalLink, productImage, affiliateLink } = payload;

  if (originalLink !== undefined && !isValidUrl(originalLink)) {
    throw new HttpError(400, 'Link original inválido.');
  }

  if (productImage !== undefined && !isValidUrl(productImage)) {
    throw new HttpError(400, 'Imagem do produto deve ser uma URL válida.');
  }

  if (affiliateLink !== undefined && !isValidUrl(affiliateLink)) {
    throw new HttpError(400, 'Link afiliado inválido.');
  }
};

const validatePhrase = (catchyPhrase: string | undefined): void => {
  if (catchyPhrase !== undefined && catchyPhrase.trim().length === 0) {
    throw new HttpError(400, 'Frase chamativa inválida.');
  }
};

const listAffiliateLinks = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const links = await affiliateLinkService.listAffiliateLinks();
    res.status(200).json({ links });
  } catch (error) {
    next(error);
  }
};

const createAffiliateLink = async (
  req: Request<Record<string, never>, unknown, CreateAffiliateLinkBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { originalLink, productImage, catchyPhrase, affiliateLink } = req.body;

    if (!originalLink || !productImage || !catchyPhrase || !affiliateLink) {
      throw new HttpError(400, 'Link original, imagem, frase e link afiliado são obrigatórios.');
    }

    validateUrls({ originalLink, productImage, affiliateLink });
    validatePhrase(catchyPhrase);

    const link = await affiliateLinkService.createAffiliateLink({
      originalLink,
      productImage,
      catchyPhrase,
      affiliateLink
    });

    res.status(201).json({ link });
  } catch (error) {
    next(error);
  }
};

const updateAffiliateLink = async (
  req: Request<{ id: string }, unknown, UpdateAffiliateLinkBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    const { originalLink, productImage, catchyPhrase, affiliateLink } = req.body;

    validateUrls({ originalLink, productImage, affiliateLink });
    validatePhrase(catchyPhrase);

    const link = await affiliateLinkService.updateAffiliateLink(id, {
      originalLink,
      productImage,
      catchyPhrase,
      affiliateLink
    });

    res.status(200).json({ link });
  } catch (error) {
    next(error);
  }
};

const deleteAffiliateLink = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    await affiliateLinkService.deleteAffiliateLink(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export { createAffiliateLink, deleteAffiliateLink, listAffiliateLinks, updateAffiliateLink };
