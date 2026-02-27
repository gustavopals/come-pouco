import { NextFunction, Request, Response } from 'express';

import * as purchasePlatformService from '../services/purchase-platform.service';
import HttpError from '../utils/httpError';

interface CreatePurchasePlatformBody {
  name?: string;
  description?: string;
  isActive?: boolean;
  apiLink?: string;
  accessKey?: string;
}

interface UpdatePurchasePlatformBody {
  name?: string;
  description?: string;
  isActive?: boolean;
  apiLink?: string;
  accessKey?: string;
}

const parseId = (value: string): number => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'ID inválido.');
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
    throw new HttpError(400, `${fieldLabel} inválido(a).`);
  }
};

const validateApiLink = (apiLink: string | undefined): void => {
  if (apiLink !== undefined && !isValidUrl(apiLink)) {
    throw new HttpError(400, 'Link da API inválido.');
  }
};

const validateIsActive = (isActive: boolean | undefined): void => {
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    throw new HttpError(400, 'Campo Ativo? inválido.');
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
    const { name, description, isActive, apiLink, accessKey } = req.body;

    if (!name || !description || !apiLink || !accessKey) {
      throw new HttpError(400, 'Nome, descrição, link da API e chave de acesso são obrigatórios.');
    }

    validateStringField(name, 'Nome');
    validateStringField(description, 'Descrição');
    validateStringField(accessKey, 'Chave de acesso');
    validateApiLink(apiLink);
    validateIsActive(isActive);

    const platform = await purchasePlatformService.createPurchasePlatform({
      name,
      description,
      isActive: isActive ?? true,
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
    const id = parseId(req.params.id);
    const { name, description, isActive, apiLink, accessKey } = req.body;

    validateStringField(name, 'Nome');
    validateStringField(description, 'Descrição');
    validateStringField(accessKey, 'Chave de acesso');
    validateApiLink(apiLink);
    validateIsActive(isActive);

    const platform = await purchasePlatformService.updatePurchasePlatform(id, {
      name,
      description,
      isActive,
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
    const id = parseId(req.params.id);
    await purchasePlatformService.deletePurchasePlatform(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export { createPurchasePlatform, deletePurchasePlatform, listPurchasePlatforms, updatePurchasePlatform };
