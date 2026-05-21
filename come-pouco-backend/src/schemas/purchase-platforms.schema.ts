import { z } from 'zod';

import {
  httpUrlSchema,
  idParamsSchema,
  optionalHttpUrlSchema,
  optionalNonEmptyString,
  paginationQueryShape,
  positiveIdSchema,
  requiredTrimmedString
} from './common.schema';

const SHOPEE_DEFAULT_API_URL = 'https://open-api.affiliate.shopee.com.br/graphql';

const purchasePlatformTypeSchema = z.enum(['SHOPEE']);

const createPurchasePlatformBodySchema = z
  .object({
    name: requiredTrimmedString('Nome', 120),
    description: requiredTrimmedString('Descricao', 2000),
    type: purchasePlatformTypeSchema.default('SHOPEE'),
    appId: requiredTrimmedString('App ID', 120),
    secret: requiredTrimmedString('Secret', 2048),
    isActive: z.boolean().default(true),
    mockMode: z.boolean().default(false),
    apiUrl: httpUrlSchema('Link da API').default(SHOPEE_DEFAULT_API_URL),
    apiLink: optionalHttpUrlSchema('Link da API'),
    accessKey: optionalNonEmptyString('Access Key', 2048)
  })
  .transform((value) => ({
    ...value,
    apiUrl: value.apiUrl ?? value.apiLink ?? SHOPEE_DEFAULT_API_URL
  }));

const updatePurchasePlatformBodySchema = z.object({
  name: optionalNonEmptyString('Nome', 120),
  description: optionalNonEmptyString('Descricao', 2000),
  type: purchasePlatformTypeSchema.optional(),
  appId: optionalNonEmptyString('App ID', 120),
  secret: optionalNonEmptyString('Secret', 2048),
  isActive: z.boolean().optional(),
  mockMode: z.boolean().optional(),
  apiUrl: optionalHttpUrlSchema('Link da API'),
  apiLink: optionalHttpUrlSchema('Link da API'),
  accessKey: optionalNonEmptyString('Access Key', 2048)
});

const updatePlatformCompaniesBodySchema = z.object({
  companyIds: z.array(positiveIdSchema('companyId')).default([]),
  defaultCompanyIds: z.array(positiveIdSchema('defaultCompanyId')).default([])
});

const purchasePlatformParamsSchema = idParamsSchema;
const purchasePlatformQuerySchema = z.object({
  ...paginationQueryShape
});

type CreatePurchasePlatformBody = z.infer<typeof createPurchasePlatformBodySchema>;
type UpdatePurchasePlatformBody = z.infer<typeof updatePurchasePlatformBodySchema>;
type UpdatePlatformCompaniesBody = z.infer<typeof updatePlatformCompaniesBodySchema>;
type PurchasePlatformParams = z.infer<typeof purchasePlatformParamsSchema>;
type PurchasePlatformQuery = z.infer<typeof purchasePlatformQuerySchema>;

export {
  createPurchasePlatformBodySchema,
  purchasePlatformParamsSchema,
  purchasePlatformQuerySchema,
  updatePlatformCompaniesBodySchema,
  updatePurchasePlatformBodySchema
};
export type {
  CreatePurchasePlatformBody,
  PurchasePlatformParams,
  PurchasePlatformQuery,
  UpdatePlatformCompaniesBody,
  UpdatePurchasePlatformBody
};
