import { NextFunction, Request, Response } from 'express';

import env from '../config/env';
import type { GenerateShopeeShortLinksBody } from '../schemas/integration.schema';
import * as companyService from '../services/company.service';
import * as companyPlatformService from '../services/company-platform.service';
import * as purchasePlatformService from '../services/purchase-platform.service';
import { generateShopeeShortLinks } from '../services/shopee-integration.service';
import HttpError from '../utils/httpError';

const isValidUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
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

    const { platformId: requestedPlatformId, originUrls, subId1 } = req.body;

    let effectivePlatformId: number | null = null;

    if (req.userRole === 'ADMIN') {
      if (requestedPlatformId !== undefined) {
        effectivePlatformId = requestedPlatformId;
      } else {
        const platforms = await purchasePlatformService.listAllPurchasePlatforms();
        const activeShopeePlatforms = platforms.filter(
          (platform) => platform.type === 'SHOPEE' && platform.isActive
        );

        if (!activeShopeePlatforms.length) {
          throw new HttpError(
            400,
            'Nenhuma plataforma SHOPEE ativa encontrada. Cadastre ou ative uma plataforma.'
          );
        }

        if (activeShopeePlatforms.length > 1) {
          throw new HttpError(
            400,
            'Mais de uma plataforma SHOPEE ativa encontrada. Informe platformId.'
          );
        }

        effectivePlatformId = activeShopeePlatforms[0].id;
      }
    } else {
      if (requestedPlatformId !== undefined) {
        throw new HttpError(403, 'Apenas ADMIN pode escolher plataforma manualmente.');
      }

      if (!req.companyId) {
        throw new HttpError(
          400,
          'Empresa sem plataforma Shopee configurada. Peça ao admin para configurar.'
        );
      }

      const company = await companyService.getCompanyById(req.companyId);

      if (!company) {
        throw new HttpError(404, 'Empresa nao encontrada.');
      }

      const linkedPlatform = await companyPlatformService.getShopeePlatformForCompany(
        req.companyId
      );

      if (linkedPlatform?.id) {
        effectivePlatformId = linkedPlatform.id;
      } else {
        const legacyPlatformId = company.shopeePlatform?.id ?? null;
        effectivePlatformId = legacyPlatformId;
      }

      if (!effectivePlatformId) {
        throw new HttpError(
          400,
          'Empresa sem plataforma Shopee configurada. Peça ao admin para configurar.'
        );
      }
    }

    if (!effectivePlatformId) {
      throw new HttpError(
        400,
        'Empresa sem plataforma Shopee configurada. Peça ao admin para configurar.'
      );
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
      subId1: subId1 ?? undefined,
      forceMock: platform.mockMode
    });

    res.status(200).json({ results });
  } catch (error) {
    next(error);
  }
};

export { generateShopeeShortLinksController };
