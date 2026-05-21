import { z } from 'zod';

import { idParamsSchema, requiredTrimmedString } from './common.schema';

const emptyToNull = (value: unknown): unknown => (value === '' ? null : value);

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor primaria deve usar formato hexadecimal, ex: #10b981.');

const optionalNullableUrlSchema = (fieldLabel: string, maxLength = 2048) =>
  z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .url(`${fieldLabel} deve ser uma URL valida.`)
      .max(maxLength, `${fieldLabel} deve ter no maximo ${maxLength} caracteres.`)
      .nullable()
      .optional()
  );

const requiredNullableStringSchema = (fieldLabel: string, maxLength = 255) =>
  z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .max(maxLength, `${fieldLabel} deve ter no maximo ${maxLength} caracteres.`)
      .nullable()
  );

const requiredNullableUrlSchema = (fieldLabel: string, maxLength = 2048) =>
  z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .url(`${fieldLabel} deve ser uma URL valida.`)
      .max(maxLength, `${fieldLabel} deve ter no maximo ${maxLength} caracteres.`)
      .nullable()
  );

const landingConfigParamsSchema = idParamsSchema;

const updateLandingConfigBodySchema = z.object({
  bannerText: requiredTrimmedString('Texto do banner', 160).optional(),
  bannerEmoji: requiredTrimmedString('Emoji do banner', 16).optional(),
  heroTitle: requiredTrimmedString('Titulo principal', 160).optional(),
  heroSubtitle: requiredTrimmedString('Subtitulo', 280).optional(),
  howItWorksSteps: z
    .array(requiredTrimmedString('Passo', 120))
    .min(1, 'Informe ao menos 1 passo.')
    .max(4, 'Informe no maximo 4 passos.')
    .optional(),
  primaryColor: hexColorSchema.optional(),
  logoUrl: optionalNullableUrlSchema('URL do logo'),
  isActive: z.boolean().optional()
});

const updateCompanyPublicSlugBodySchema = z.object({
  publicSlug: requiredNullableStringSchema('Slug publico', 80)
});

const updateCompanyFallbackUrlBodySchema = z.object({
  fallbackAffiliateUrl: requiredNullableUrlSchema('URL de fallback')
});

const updateUserPublicSlugBodySchema = z.object({
  publicSlug: requiredNullableStringSchema('Slug publico', 80)
});

type LandingConfigParams = z.infer<typeof landingConfigParamsSchema>;
type UpdateLandingConfigBody = z.infer<typeof updateLandingConfigBodySchema>;
type UpdateCompanyPublicSlugBody = z.infer<typeof updateCompanyPublicSlugBodySchema>;
type UpdateCompanyFallbackUrlBody = z.infer<typeof updateCompanyFallbackUrlBodySchema>;
type UpdateUserPublicSlugBody = z.infer<typeof updateUserPublicSlugBodySchema>;

export {
  landingConfigParamsSchema,
  updateCompanyFallbackUrlBodySchema,
  updateCompanyPublicSlugBodySchema,
  updateLandingConfigBodySchema,
  updateUserPublicSlugBodySchema
};
export type {
  LandingConfigParams,
  UpdateCompanyFallbackUrlBody,
  UpdateCompanyPublicSlugBody,
  UpdateLandingConfigBody,
  UpdateUserPublicSlugBody
};
