import { NextFunction, Request, Response } from 'express';

import env from '../config/env';
import { MAX_BATCH_LINKS } from '../constants/affiliate-links.constants';
import * as companyService from '../services/company.service';
import * as companyPlatformService from '../services/company-platform.service';
import * as purchasePlatformService from '../services/purchase-platform.service';
import { generateShopeeShortLinks } from '../services/shopee-integration.service';
import HttpError from '../utils/httpError';

interface GenerateShopeeShortLinksBody {
  platformId?: number;
  originUrls?: unknown;
  subId1?: string;
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

const normalizeOriginUrls = (originUrls: unknown): string[] => {
  if (!Array.isArray(originUrls)) {
    return [];
  }

  return originUrls
    .map((url) => (typeof url === 'string' ? url.trim() : ''))
    .filter((url) => url.length > 0);
};

const maxLinksExceededPayload = {
  error: 'MAX_LINKS_EXCEEDED',
  message: `Envie no máximo ${MAX_BATCH_LINKS} links por vez.`,
  max: MAX_BATCH_LINKS
};

const validateSubId1 = (subId1: string | undefined): string | undefined => {
  if (subId1 === undefined) {
    return undefined;
  }

  const normalized = subId1.trim();

  if (!normalized.length) {
    return undefined;
  }

  if (normalized.length > 50) {
    throw new HttpError(400, 'subId1 deve ter no maximo 50 caracteres.');
  }

  if (!SUB_ID1_PATTERN.test(normalized)) {
    throw new HttpError(400, 'subId1 invalido. Use apenas letras, numeros, underscore e hifen.');
  }

  return normalized;
};

const generateShopeeShortLinksController = async (
  req: Request<Record<string, never>, unknown, GenerateShopeeShortLinksBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId || !req.userRole) {
      throw new HttpError(401, 'Token invalido ou expirado.');
    }

    const requestedPlatformId = req.body.platformId !== undefined ? Number(req.body.platformId) : undefined;
    if (!Array.isArray(req.body.originUrls)) {
      res.status(400).json({
        error: 'INVALID_LINKS_PAYLOAD',
        message: 'O campo originUrls deve ser um array de links.'
      });
      return;
    }

    const originUrls = normalizeOriginUrls(req.body.originUrls);
    const subId1 = validateSubId1(req.body.subId1);

    if (!originUrls.length) {
      res.status(400).json({
        error: 'EMPTY_LINKS_BATCH',
        message: 'Envie ao menos 1 link por vez.'
      });
      return;
    }

    if (originUrls.length > MAX_BATCH_LINKS) {
      res.status(400).json(maxLinksExceededPayload);
      return;
    }

    if (originUrls.some((originUrl) => !isValidUrl(originUrl))) {
      throw new HttpError(400, 'Cada originUrl deve ser uma URL valida.');
    }

    let effectivePlatformId: number | null = null;

    if (req.userRole === 'ADMIN') {
      if (requestedPlatformId !== undefined) {
        if (!Number.isInteger(requestedPlatformId) || requestedPlatformId <= 0) {
          throw new HttpError(400, 'platformId invalido.');
        }

        effectivePlatformId = requestedPlatformId;
      } else {
        const platforms = await purchasePlatformService.listPurchasePlatforms();
        const activeShopeePlatforms = platforms.filter((platform) => platform.type === 'SHOPEE' && platform.isActive);

        if (!activeShopeePlatforms.length) {
          throw new HttpError(400, 'Nenhuma plataforma SHOPEE ativa encontrada. Cadastre ou ative uma plataforma.');
        }

        if (activeShopeePlatforms.length > 1) {
          throw new HttpError(400, 'Mais de uma plataforma SHOPEE ativa encontrada. Informe platformId.');
        }

        effectivePlatformId = activeShopeePlatforms[0].id;
      }
    } else {
      if (requestedPlatformId !== undefined) {
        throw new HttpError(403, 'Apenas ADMIN pode escolher plataforma manualmente.');
      }

      if (!req.companyId) {
        throw new HttpError(400, 'Empresa sem plataforma Shopee configurada. Peça ao admin para configurar.');
      }

      const company = await companyService.getCompanyById(req.companyId);

      if (!company) {
        throw new HttpError(404, 'Empresa nao encontrada.');
      }

      const linkedPlatform = await companyPlatformService.getShopeePlatformForCompany(req.companyId);

      if (linkedPlatform?.id) {
        effectivePlatformId = linkedPlatform.id;
      } else {
        const legacyPlatformId = company.shopeePlatform?.id ?? null;
        effectivePlatformId = legacyPlatformId;
      }

      if (!effectivePlatformId) {
        throw new HttpError(400, 'Empresa sem plataforma Shopee configurada. Peça ao admin para configurar.');
      }
    }

    if (!effectivePlatformId) {
      throw new HttpError(400, 'Empresa sem plataforma Shopee configurada. Peça ao admin para configurar.');
    }

    const platform = await purchasePlatformService.getPurchasePlatformById(effectivePlatformId);

    if (!platform) {
      throw new HttpError(404, 'Plataforma de compras nao encontrada.');
    }

    if (!platform.isActive) {
      throw new HttpError(403, 'A plataforma selecionada esta inativa.');
    }

    if (platform.type !== 'SHOPEE') {
      throw new HttpError(400, 'A plataforma selecionada nao e do tipo SHOPEE.');
    }

    const shouldUseMock = platform.mockMode || env.shopeeMock;

    if (!shouldUseMock && (!platform.appId.trim().length || !platform.secret.trim().length)) {
      throw new HttpError(400, 'Plataforma SHOPEE sem credenciais completas (App ID e Secret).');
    }

    if (!platform.apiUrl.trim().length || !isValidUrl(platform.apiUrl)) {
      throw new HttpError(400, 'Plataforma SHOPEE com Link da API invalido.');
    }

    const results = await generateShopeeShortLinks({
      appId: platform.appId,
      secret: platform.secret,
      apiUrl: platform.apiUrl,
      originUrls,
      companyId: req.companyId ?? undefined,
      userId: req.userId,
      platformId: platform.id,
      subId1,
      forceMock: platform.mockMode
    });

    res.status(200).json({ results });
  } catch (error) {
    next(error);
  }
};

export { generateShopeeShortLinksController };
