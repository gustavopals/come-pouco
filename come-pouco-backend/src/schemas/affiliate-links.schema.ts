import { z } from 'zod';

import { MAX_BATCH_LINKS } from '../constants/affiliate-links.constants';
import {
  httpUrlSchema,
  idParamsSchema,
  optionalHttpUrlSchema,
  optionalNonEmptyString,
  optionalDateQuerySchema,
  optionalPositiveIdQuerySchema,
  paginationQueryShape,
  positiveIdSchema,
  subId1CreateSchema,
  subId1UpdateSchema
} from './common.schema';

const generatedLinkSchema = z.object({
  originUrl: httpUrlSchema('originUrl'),
  shortLink: httpUrlSchema('shortLink')
});

const createAffiliateLinkBodySchema = z
  .object({
    originalLinks: z
      .array(httpUrlSchema('Link original'))
      .max(MAX_BATCH_LINKS, `No maximo ${MAX_BATCH_LINKS} links originais por cadastro.`)
      .optional(),
    originalLink: httpUrlSchema('Link original').optional(),
    generatedLinks: z
      .array(generatedLinkSchema)
      .max(MAX_BATCH_LINKS, `No maximo ${MAX_BATCH_LINKS} links por cadastro.`)
      .optional(),
    subId1: subId1CreateSchema,
    productImage: optionalHttpUrlSchema('Imagem do produto'),
    catchyPhrase: optionalNonEmptyString('Frase chamativa', 255),
    affiliateLink: httpUrlSchema('Link afiliado').optional(),
    companyId: positiveIdSchema('companyId').optional()
  })
  .superRefine((value, ctx) => {
    if (value.generatedLinks?.length) {
      return;
    }

    const originalLinks = value.originalLinks ?? (value.originalLink ? [value.originalLink] : []);

    if (!originalLinks.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['originalLinks'],
        message: 'Informe ao menos 1 link original.'
      });
    }

    if (originalLinks.length > MAX_BATCH_LINKS) {
      ctx.addIssue({
        code: 'custom',
        path: ['originalLinks'],
        message: `No maximo ${MAX_BATCH_LINKS} links originais por cadastro.`
      });
    }

    if (!value.affiliateLink) {
      ctx.addIssue({
        code: 'custom',
        path: ['affiliateLink'],
        message: 'Link afiliado e obrigatorio.'
      });
    }
  });

const updateAffiliateLinkBodySchema = z.object({
  originalLink: httpUrlSchema('Link original').optional(),
  subId1: subId1UpdateSchema,
  productImage: optionalHttpUrlSchema('Imagem do produto'),
  catchyPhrase: optionalNonEmptyString('Frase chamativa', 255),
  affiliateLink: httpUrlSchema('Link afiliado').optional()
});

const affiliateLinkParamsSchema = idParamsSchema;

const affiliateLinkQuerySchema = z
  .object({
    search: optionalNonEmptyString('Busca', 255),
    companyId: optionalPositiveIdQuerySchema('companyId'),
    createdByUserId: optionalPositiveIdQuerySchema('createdByUserId'),
    startDate: optionalDateQuerySchema('startDate'),
    endDate: optionalDateQuerySchema('endDate', true),
    ...paginationQueryShape
  })
  .refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
    message: 'startDate deve ser menor ou igual a endDate.',
    path: ['startDate']
  });

type CreateAffiliateLinkBody = z.infer<typeof createAffiliateLinkBodySchema>;
type UpdateAffiliateLinkBody = z.infer<typeof updateAffiliateLinkBodySchema>;
type AffiliateLinkParams = z.infer<typeof affiliateLinkParamsSchema>;
type AffiliateLinkQuery = z.infer<typeof affiliateLinkQuerySchema>;

export {
  affiliateLinkParamsSchema,
  affiliateLinkQuerySchema,
  createAffiliateLinkBodySchema,
  updateAffiliateLinkBodySchema
};
export type {
  AffiliateLinkParams,
  AffiliateLinkQuery,
  CreateAffiliateLinkBody,
  UpdateAffiliateLinkBody
};
