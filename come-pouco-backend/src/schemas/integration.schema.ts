import { z } from 'zod';

import { MAX_BATCH_LINKS } from '../constants/affiliate-links.constants';
import { httpUrlSchema, positiveIdSchema, subId1UpdateSchema } from './common.schema';

const generateShopeeShortLinksBodySchema = z.object({
  platformId: positiveIdSchema('platformId').optional(),
  originUrls: z
    .array(httpUrlSchema('originUrl'))
    .min(1, 'Envie ao menos 1 link por vez.')
    .max(MAX_BATCH_LINKS, `Envie no maximo ${MAX_BATCH_LINKS} links por vez.`),
  subId1: subId1UpdateSchema
});

type GenerateShopeeShortLinksBody = z.infer<typeof generateShopeeShortLinksBodySchema>;

export { generateShopeeShortLinksBodySchema };
export type { GenerateShopeeShortLinksBody };
