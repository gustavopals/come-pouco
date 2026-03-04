import { NextFunction, Request, Response } from 'express';

import { MAX_BATCH_LINKS } from '../constants/affiliate-links.constants';
import * as affiliateLinkService from '../services/affiliate-link.service';
import HttpError from '../utils/httpError';

interface GeneratedLinkInput {
  originUrl?: string;
  shortLink?: string;
}

interface CreateAffiliateLinkBody {
  originalLinks?: string[];
  originalLink?: string;
  generatedLinks?: GeneratedLinkInput[];
  subId1?: string | null;
  productImage?: string;
  catchyPhrase?: string;
  affiliateLink?: string;
  companyId?: number;
}

interface UpdateAffiliateLinkBody {
  originalLink?: string;
  subId1?: string | null;
  productImage?: string;
  catchyPhrase?: string;
  affiliateLink?: string;
}

const SUB_ID1_PATTERN = /^[A-Za-z0-9_-]+$/;

const isValidUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const ensureAuthContext = (req: Request): void => {
  if (!req.userId || !req.userRole) {
    throw new HttpError(401, 'Token invalido ou expirado.');
  }
};

const parseId = (value: string): number => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'ID invalido.');
  }

  return id;
};

const normalizeOriginalLinks = ({ originalLinks, originalLink }: Pick<CreateAffiliateLinkBody, 'originalLinks' | 'originalLink'>): string[] => {
  if (Array.isArray(originalLinks)) {
    return originalLinks.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => item.length > 0);
  }

  if (typeof originalLink === 'string' && originalLink.trim().length > 0) {
    return [originalLink.trim()];
  }

  return [];
};

const normalizeGeneratedLinks = (generatedLinks: GeneratedLinkInput[] | undefined): Array<{ originUrl: string; shortLink: string }> => {
  if (!Array.isArray(generatedLinks)) {
    return [];
  }

  return generatedLinks
    .map((item) => ({
      originUrl: typeof item.originUrl === 'string' ? item.originUrl.trim() : '',
      shortLink: typeof item.shortLink === 'string' ? item.shortLink.trim() : ''
    }))
    .filter((item) => item.originUrl.length > 0 && item.shortLink.length > 0);
};

const validateCreateOriginalLinks = (links: string[]): void => {
  if (!links.length) {
    throw new HttpError(400, 'Informe ao menos 1 link original.');
  }

  if (links.length > MAX_BATCH_LINKS) {
    throw new HttpError(400, `No maximo ${MAX_BATCH_LINKS} links originais por cadastro.`);
  }

  const invalidLink = links.find((link) => !isValidUrl(link));
  if (invalidLink) {
    throw new HttpError(400, 'Cada link original precisa ser uma URL valida.');
  }
};

const validateGeneratedLinks = (generatedLinks: Array<{ originUrl: string; shortLink: string }>): void => {
  if (!generatedLinks.length) {
    throw new HttpError(400, 'Informe ao menos 1 resultado de shortlink para salvar.');
  }

  if (generatedLinks.length > MAX_BATCH_LINKS) {
    throw new HttpError(400, `No maximo ${MAX_BATCH_LINKS} links por cadastro.`);
  }

  if (generatedLinks.some((item) => !isValidUrl(item.originUrl) || !isValidUrl(item.shortLink))) {
    throw new HttpError(400, 'Cada originUrl e shortLink devem ser URLs validas.');
  }
};

const validateUrls = (payload: { originalLink?: string; productImage?: string; affiliateLink?: string }): void => {
  const { originalLink, productImage, affiliateLink } = payload;

  if (originalLink !== undefined && !isValidUrl(originalLink)) {
    throw new HttpError(400, 'Link original invalido.');
  }

  if (productImage !== undefined && productImage.trim().length > 0 && !isValidUrl(productImage)) {
    throw new HttpError(400, 'Imagem do produto deve ser uma URL valida.');
  }

  if (affiliateLink !== undefined && !isValidUrl(affiliateLink)) {
    throw new HttpError(400, 'Link afiliado invalido.');
  }
};

const validatePhrase = (catchyPhrase: string | undefined): void => {
  if (catchyPhrase !== undefined && catchyPhrase.trim().length === 0) {
    throw new HttpError(400, 'Frase chamativa invalida.');
  }
};

const normalizeAndValidateSubId1 = (subId1: string | null | undefined): string | null => {
  if (subId1 === null || subId1 === undefined) {
    return null;
  }

  const normalized = subId1.trim();

  if (!normalized.length) {
    return null;
  }

  if (normalized.length > 50) {
    throw new HttpError(400, 'sub_id1 deve ter no maximo 50 caracteres.');
  }

  if (!SUB_ID1_PATTERN.test(normalized)) {
    throw new HttpError(400, 'sub_id1 invalido. Use apenas letras, numeros, underscore e hifen.');
  }

  return normalized;
};

const normalizeAndValidateOptionalSubId1 = (subId1: string | null | undefined): string | null | undefined => {
  if (subId1 === undefined) {
    return undefined;
  }

  return normalizeAndValidateSubId1(subId1);
};

const listAffiliateLinks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    ensureAuthContext(req);

    const companyIdFilter = req.userRole === 'ADMIN' && req.query.companyId ? Number(req.query.companyId) : null;

    const links = await affiliateLinkService.listAffiliateLinks({
      requesterUserId: req.userId!,
      requesterRole: req.userRole!,
      requesterCompanyId: req.companyId ?? null,
      requesterCompanyRole: req.companyRole ?? null,
      companyIdFilter: companyIdFilter && Number.isInteger(companyIdFilter) && companyIdFilter > 0 ? companyIdFilter : undefined
    });

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
    ensureAuthContext(req);

    const { productImage, catchyPhrase, affiliateLink, subId1, companyId } = req.body;
    const generatedLinks = normalizeGeneratedLinks(req.body.generatedLinks);

    if (generatedLinks.length) {
      validateGeneratedLinks(generatedLinks);
      validateUrls({ productImage });
      validatePhrase(catchyPhrase);

      const links = await affiliateLinkService.createAffiliateLinksFromGenerated(
        {
          generatedLinks,
          subId1: normalizeAndValidateSubId1(subId1),
          productImage: productImage ?? '',
          catchyPhrase: catchyPhrase ?? '',
          companyId: req.userRole === 'ADMIN' ? companyId ?? null : undefined
        },
        {
          requesterUserId: req.userId!,
          requesterRole: req.userRole!,
          requesterCompanyId: req.companyId ?? null,
          requesterCompanyRole: req.companyRole ?? null
        }
      );

      res.status(201).json({ links });
      return;
    }

    const originalLinks = normalizeOriginalLinks(req.body);

    if (!affiliateLink) {
      throw new HttpError(400, 'Link afiliado e obrigatorio.');
    }

    validateCreateOriginalLinks(originalLinks);
    validateUrls({ productImage, affiliateLink });
    validatePhrase(catchyPhrase);

    const links = await affiliateLinkService.createAffiliateLinks(
      {
        originalLinks,
        subId1: normalizeAndValidateSubId1(subId1),
        productImage: productImage ?? '',
        catchyPhrase: catchyPhrase ?? '',
        affiliateLink,
        companyId: req.userRole === 'ADMIN' ? companyId ?? null : undefined
      },
      {
        requesterUserId: req.userId!,
        requesterRole: req.userRole!,
        requesterCompanyId: req.companyId ?? null,
        requesterCompanyRole: req.companyRole ?? null
      }
    );

    res.status(201).json({ links });
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
    ensureAuthContext(req);

    const id = parseId(req.params.id);
    const { originalLink, subId1, productImage, catchyPhrase, affiliateLink } = req.body;

    validateUrls({ originalLink, productImage, affiliateLink });
    validatePhrase(catchyPhrase);

    const link = await affiliateLinkService.updateAffiliateLink(
      id,
      {
        originalLink,
        subId1: normalizeAndValidateOptionalSubId1(subId1),
        productImage,
        catchyPhrase,
        affiliateLink
      },
      {
        requesterUserId: req.userId!,
        requesterRole: req.userRole!,
        requesterCompanyId: req.companyId ?? null,
        requesterCompanyRole: req.companyRole ?? null
      }
    );

    res.status(200).json({ link });
  } catch (error) {
    next(error);
  }
};

const deleteAffiliateLink = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
  try {
    ensureAuthContext(req);

    const id = parseId(req.params.id);

    await affiliateLinkService.deleteAffiliateLink(id, {
      requesterUserId: req.userId!,
      requesterRole: req.userRole!,
      requesterCompanyId: req.companyId ?? null,
      requesterCompanyRole: req.companyRole ?? null
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const deleteAffiliateLinks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    ensureAuthContext(req);

    const companyIdFilter = req.userRole === 'ADMIN' && req.query.companyId ? Number(req.query.companyId) : null;

    const deletedCount = await affiliateLinkService.deleteAffiliateLinks({
      requesterUserId: req.userId!,
      requesterRole: req.userRole!,
      requesterCompanyId: req.companyId ?? null,
      requesterCompanyRole: req.companyRole ?? null,
      companyIdFilter: companyIdFilter && Number.isInteger(companyIdFilter) && companyIdFilter > 0 ? companyIdFilter : undefined
    });

    res.status(200).json({ deletedCount });
  } catch (error) {
    next(error);
  }
};

export { createAffiliateLink, deleteAffiliateLink, deleteAffiliateLinks, listAffiliateLinks, updateAffiliateLink };
