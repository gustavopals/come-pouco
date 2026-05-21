import { NextFunction, Request, Response } from 'express';

import type {
  AffiliateLinkQuery,
  CreateAffiliateLinkBody,
  UpdateAffiliateLinkBody
} from '../schemas/affiliate-links.schema';
import * as affiliateLinkService from '../services/affiliate-link.service';
import HttpError from '../utils/httpError';

const ensureAuthContext = (req: Request): void => {
  if (!req.userId || !req.userRole) {
    throw new HttpError(401, 'Token invalido ou expirado.');
  }
};

const normalizeOriginalLinks = ({
  originalLinks,
  originalLink
}: Pick<CreateAffiliateLinkBody, 'originalLinks' | 'originalLink'>): string[] => {
  if (Array.isArray(originalLinks)) {
    return originalLinks;
  }

  if (originalLink) {
    return [originalLink];
  }

  return [];
};

const listAffiliateLinks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureAuthContext(req);

    const query = req.query as unknown as AffiliateLinkQuery;
    const companyIdFilter = req.userRole === 'ADMIN' ? query.companyId : undefined;

    const result = await affiliateLinkService.listAffiliateLinks({
      requesterUserId: req.userId!,
      requesterRole: req.userRole!,
      requesterCompanyId: req.companyId ?? null,
      requesterCompanyRole: req.companyRole ?? null,
      companyIdFilter,
      createdByUserIdFilter: query.createdByUserId,
      search: query.search,
      startDate: query.startDate,
      endDate: query.endDate,
      pagination: {
        page: query.page,
        limit: query.limit
      }
    });

    res
      .status(200)
      .json({ links: result.items, data: result.data, items: result.items, meta: result.meta });
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
    const generatedLinks = req.body.generatedLinks ?? [];

    if (generatedLinks.length) {
      const links = await affiliateLinkService.createAffiliateLinksFromGenerated(
        {
          generatedLinks,
          subId1,
          productImage: productImage ?? '',
          catchyPhrase: catchyPhrase ?? '',
          companyId: req.userRole === 'ADMIN' ? (companyId ?? null) : undefined
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

    const links = await affiliateLinkService.createAffiliateLinks(
      {
        originalLinks,
        subId1,
        productImage: productImage ?? '',
        catchyPhrase: catchyPhrase ?? '',
        affiliateLink: affiliateLink!,
        companyId: req.userRole === 'ADMIN' ? (companyId ?? null) : undefined
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

    const id = Number(req.params.id);
    const { originalLink, subId1, productImage, catchyPhrase, affiliateLink } = req.body;

    const link = await affiliateLinkService.updateAffiliateLink(
      id,
      {
        originalLink,
        subId1,
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

const deleteAffiliateLink = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureAuthContext(req);

    const id = Number(req.params.id);

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

const deleteAffiliateLinks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureAuthContext(req);

    const query = req.query as unknown as AffiliateLinkQuery;
    const companyIdFilter = req.userRole === 'ADMIN' ? query.companyId : undefined;

    const deletedCount = await affiliateLinkService.deleteAffiliateLinks({
      requesterUserId: req.userId!,
      requesterRole: req.userRole!,
      requesterCompanyId: req.companyId ?? null,
      requesterCompanyRole: req.companyRole ?? null,
      companyIdFilter
    });

    res.status(200).json({ deletedCount });
  } catch (error) {
    next(error);
  }
};

export {
  createAffiliateLink,
  deleteAffiliateLink,
  deleteAffiliateLinks,
  listAffiliateLinks,
  updateAffiliateLink
};
