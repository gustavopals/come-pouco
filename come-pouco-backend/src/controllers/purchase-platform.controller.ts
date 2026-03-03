import { NextFunction, Request, Response } from 'express';

import * as purchasePlatformService from '../services/purchase-platform.service';
import HttpError from '../utils/httpError';

const SHOPEE_DEFAULT_API_URL = 'https://open-api.affiliate.shopee.com.br/graphql';
type PurchasePlatformType = 'SHOPEE';

const ensureAdmin = (req: Request): void => {
  if (req.userRole !== 'ADMIN') {
    throw new HttpError(403, 'Apenas ADMIN pode gerenciar plataformas de compras.');
  }
};

interface CreatePurchasePlatformBody {
  name?: string;
  description?: string;
  type?: PurchasePlatformType;
  appId?: string;
  secret?: string;
  isActive?: boolean;
  mockMode?: boolean;
  apiUrl?: string;
  apiLink?: string;
  accessKey?: string;
}

interface UpdatePurchasePlatformBody {
  name?: string;
  description?: string;
  type?: PurchasePlatformType;
  appId?: string;
  secret?: string;
  isActive?: boolean;
  mockMode?: boolean;
  apiUrl?: string;
  apiLink?: string;
  accessKey?: string;
}

const parseId = (value: string): number => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'ID invalido.');
  }

  return id;
};

const isValidUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const validateStringField = (value: string | undefined, fieldLabel: string): void => {
  if (value !== undefined && value.trim().length === 0) {
    throw new HttpError(400, `${fieldLabel} invalido(a).`);
  }
};

const validateApiUrl = (apiUrl: string | undefined): void => {
  if (apiUrl !== undefined && !isValidUrl(apiUrl)) {
    throw new HttpError(400, 'Link da API invalido.');
  }
};

const validateIsActive = (isActive: boolean | undefined): void => {
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    throw new HttpError(400, 'Campo Ativo? invalido.');
  }
};

const validateMockMode = (mockMode: boolean | undefined): void => {
  if (mockMode !== undefined && typeof mockMode !== 'boolean') {
    throw new HttpError(400, 'Campo Modo Sandbox (Mock) invalido.');
  }
};

const validateType = (type: PurchasePlatformType | undefined): void => {
  if (type !== undefined && type !== 'SHOPEE') {
    throw new HttpError(400, 'Tipo de plataforma invalido.');
  }
};

const requireShopeeCredentials = (type: PurchasePlatformType, appId: string | undefined, secret: string | undefined): void => {
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

const listPurchasePlatforms = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const platforms = await purchasePlatformService.listPurchasePlatforms();
    res.status(200).json({ platforms });
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
    const { name, description, type, appId, secret, isActive, mockMode, apiUrl, apiLink, accessKey } = req.body;

    if (!name || !description) {
      throw new HttpError(400, 'Nome e descricao sao obrigatorios.');
    }

    const normalizedType: PurchasePlatformType = type ?? 'SHOPEE';
    const normalizedApiUrl = (apiUrl ?? apiLink ?? SHOPEE_DEFAULT_API_URL).trim();

    validateType(normalizedType);
    validateStringField(name, 'Nome');
    validateStringField(description, 'Descricao');
    validateStringField(appId, 'App ID');
    validateStringField(secret, 'Secret');
    validateApiUrl(normalizedApiUrl);
    validateApiUrl(apiLink);
    validateIsActive(isActive);
    validateMockMode(mockMode);

    requireShopeeCredentials(normalizedType, appId, secret);

    const platform = await purchasePlatformService.createPurchasePlatform({
      name,
      description,
      type: normalizedType,
      appId: appId!,
      secret: secret!,
      isActive: isActive ?? true,
      mockMode: normalizedType === 'SHOPEE' ? Boolean(mockMode) : false,
      apiUrl: normalizedApiUrl,
      apiLink,
      accessKey
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
    const id = parseId(req.params.id);
    const { name, description, type, appId, secret, isActive, mockMode, apiUrl, apiLink, accessKey } = req.body;

    validateType(type);
    validateStringField(name, 'Nome');
    validateStringField(description, 'Descricao');
    validateStringField(appId, 'App ID');
    validateStringField(secret, 'Secret');
    validateApiUrl(apiUrl);
    validateApiUrl(apiLink);
    validateIsActive(isActive);
    validateMockMode(mockMode);

    const current = await purchasePlatformService.getPurchasePlatformById(id);

    if (!current) {
      throw new HttpError(404, 'Plataforma de compras nao encontrada.');
    }

    const effectiveType = type ?? current.type;
    const effectiveAppId = appId ?? current.appId;
    const effectiveSecret = secret ?? current.secret;

    requireShopeeCredentials(effectiveType, effectiveAppId, effectiveSecret);

    const platform = await purchasePlatformService.updatePurchasePlatform(id, {
      name,
      description,
      type,
      appId,
      secret,
      isActive,
      mockMode: effectiveType === 'SHOPEE' ? mockMode : false,
      apiUrl,
      apiLink,
      accessKey
    });

    res.status(200).json({ platform });
  } catch (error) {
    next(error);
  }
};

const deletePurchasePlatform = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
  try {
    ensureAdmin(req);
    const id = parseId(req.params.id);
    await purchasePlatformService.deletePurchasePlatform(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export { createPurchasePlatform, deletePurchasePlatform, listPurchasePlatforms, updatePurchasePlatform };
