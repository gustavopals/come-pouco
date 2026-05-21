import { NextFunction, Request, Response } from 'express';

import type {
  CreatePurchasePlatformBody,
  PurchasePlatformQuery,
  UpdatePurchasePlatformBody
} from '../schemas/purchase-platforms.schema';
import { AUDIT_EVENTS } from '../constants/audit-events';
import { logEventFromRequest } from '../services/audit.service';
import * as purchasePlatformService from '../services/purchase-platform.service';
import { isMaskedSecretValue } from '../utils/encryption';
import HttpError from '../utils/httpError';

type PurchasePlatformType = 'SHOPEE';

const ensureAdmin = (req: Request): void => {
  if (req.userRole !== 'ADMIN') {
    throw new HttpError(403, 'Apenas ADMIN pode gerenciar plataformas de compras.');
  }
};

const requireShopeeCredentials = (
  type: PurchasePlatformType,
  appId: string | undefined,
  secret: string | undefined
): void => {
  if (type !== 'SHOPEE') {
    return;
  }

  if (!appId || !appId.trim().length) {
    throw new HttpError(400, 'App ID e obrigatorio quando o tipo da plataforma for SHOPEE.');
  }

  if (!secret || !secret.trim().length) {
    throw new HttpError(400, 'Secret e obrigatorio quando o tipo da plataforma for SHOPEE.');
  }
};

const toPlatformChangedFields = (body: UpdatePurchasePlatformBody): string[] =>
  Object.entries(body)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => {
      if (key === 'secret') {
        return 'secretChanged';
      }

      if (key === 'accessKey') {
        return 'accessKeyChanged';
      }

      return key;
    });

const listPurchasePlatforms = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = req.query as unknown as PurchasePlatformQuery;
    const result = await purchasePlatformService.listPurchasePlatforms({
      pagination: {
        page: query.page,
        limit: query.limit
      }
    });
    res
      .status(200)
      .json({ platforms: result.items, data: result.data, items: result.items, meta: result.meta });
  } catch (error) {
    next(error);
  }
};

const createPurchasePlatform = async (
  req: Request<Record<string, never>, unknown, CreatePurchasePlatformBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureAdmin(req);
    const {
      name,
      description,
      type,
      appId,
      secret,
      isActive,
      mockMode,
      apiUrl,
      apiLink,
      accessKey
    } = req.body;

    const platform = await purchasePlatformService.createPurchasePlatform({
      name,
      description,
      type,
      appId,
      secret,
      isActive,
      mockMode: type === 'SHOPEE' ? mockMode : false,
      apiUrl,
      apiLink,
      accessKey
    });

    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.ADMIN_PLATFORM_CREATE,
      entityType: 'PURCHASE_PLATFORM',
      entityId: platform.id,
      metadata: {
        name: platform.name,
        type: platform.type,
        isActive: platform.isActive,
        mockMode: platform.mockMode
      }
    });

    res.status(201).json({ platform });
  } catch (error) {
    next(error);
  }
};

const updatePurchasePlatform = async (
  req: Request<{ id: string }, unknown, UpdatePurchasePlatformBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureAdmin(req);
    const id = Number(req.params.id);
    const {
      name,
      description,
      type,
      appId,
      secret,
      isActive,
      mockMode,
      apiUrl,
      apiLink,
      accessKey
    } = req.body;
    const normalizedSecret = isMaskedSecretValue(secret) ? undefined : secret;
    const normalizedAccessKey = isMaskedSecretValue(accessKey) ? undefined : accessKey;

    const current = await purchasePlatformService.getPurchasePlatformById(id);

    if (!current) {
      throw new HttpError(404, 'Plataforma de compras nao encontrada.');
    }

    const effectiveType = type ?? current.type;
    const effectiveAppId = appId ?? current.appId;
    const effectiveSecret = normalizedSecret ?? current.secret;

    requireShopeeCredentials(effectiveType, effectiveAppId, effectiveSecret);

    const platform = await purchasePlatformService.updatePurchasePlatform(id, {
      name,
      description,
      type,
      appId,
      secret: normalizedSecret,
      isActive,
      mockMode: effectiveType === 'SHOPEE' ? mockMode : false,
      apiUrl,
      apiLink,
      accessKey: normalizedAccessKey
    });

    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.ADMIN_PLATFORM_UPDATE,
      entityType: 'PURCHASE_PLATFORM',
      entityId: platform.id,
      metadata: {
        changedFields: toPlatformChangedFields(req.body),
        name: platform.name,
        type: platform.type,
        isActive: platform.isActive,
        mockMode: platform.mockMode
      }
    });

    res.status(200).json({ platform });
  } catch (error) {
    next(error);
  }
};

const deletePurchasePlatform = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureAdmin(req);
    const id = Number(req.params.id);
    const current = await purchasePlatformService.getPurchasePlatformById(id);

    await purchasePlatformService.deletePurchasePlatform(id);
    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.ADMIN_PLATFORM_DELETE,
      entityType: 'PURCHASE_PLATFORM',
      entityId: id,
      metadata: {
        name: current?.name ?? null,
        type: current?.type ?? null
      }
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export {
  createPurchasePlatform,
  deletePurchasePlatform,
  listPurchasePlatforms,
  updatePurchasePlatform
};
