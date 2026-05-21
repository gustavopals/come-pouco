import { z } from 'zod';

import { ALLOWED_HISTORY_RETENTION_DAYS } from '../constants/company.constants';
import {
  idParamsSchema,
  httpUrlSchema,
  nullablePositiveIdSchema,
  nullableString,
  paginationQueryShape,
  requiredTrimmedString
} from './common.schema';

const emptyToNull = (value: unknown): unknown => (value === '' ? null : value);

const historyRetentionDaysSchema = z.coerce
  .number({ error: 'historyRetentionDays invalido.' })
  .int('historyRetentionDays invalido.')
  .positive('historyRetentionDays invalido.')
  .refine((value) => ALLOWED_HISTORY_RETENTION_DAYS.includes(value), {
    message: `historyRetentionDays invalido. Valores permitidos: ${ALLOWED_HISTORY_RETENTION_DAYS.join(', ')}.`
  });

const shopeeModeSchema = z.enum(['TEST', 'PROD']);
const nullableHttpUrlSchema = (fieldLabel: string) =>
  z.preprocess(emptyToNull, z.union([httpUrlSchema(fieldLabel), z.null()]).optional());

const companyPayloadSchema = z.object({
  name: requiredTrimmedString('Nome da empresa', 160).optional(),
  historyRetentionDays: historyRetentionDaysSchema.optional(),
  shopeePlatformId: nullablePositiveIdSchema('Plataforma Shopee'),
  shopeePlatformTestId: nullablePositiveIdSchema('Plataforma Shopee TEST'),
  shopeePlatformProdId: nullablePositiveIdSchema('Plataforma Shopee PROD'),
  shopeeMode: shopeeModeSchema.optional(),
  publicSlug: nullableString('Slug publico', 80),
  fallbackAffiliateUrl: nullableHttpUrlSchema('URL de fallback')
});

const createCompanyBodySchema = companyPayloadSchema.extend({
  name: requiredTrimmedString('Nome da empresa', 160)
});

const updateCompanyBodySchema = companyPayloadSchema;
const companyParamsSchema = idParamsSchema;
const companyQuerySchema = z.object({
  ...paginationQueryShape
});

type CreateCompanyBody = z.infer<typeof createCompanyBodySchema>;
type UpdateCompanyBody = z.infer<typeof updateCompanyBodySchema>;
type CompanyParams = z.infer<typeof companyParamsSchema>;
type CompanyQuery = z.infer<typeof companyQuerySchema>;

export {
  companyParamsSchema,
  companyQuerySchema,
  createCompanyBodySchema,
  updateCompanyBodySchema
};
export type { CompanyParams, CompanyQuery, CreateCompanyBody, UpdateCompanyBody };
