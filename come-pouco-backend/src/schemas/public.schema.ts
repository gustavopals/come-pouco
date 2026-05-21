import { z } from 'zod';

import { httpUrlSchema, optionalNonEmptyString, requiredTrimmedString } from './common.schema';

const publicSlugParamSchema = z.object({
  slug: requiredTrimmedString('Slug', 80)
});

const optionalHoneypotSchema = optionalNonEmptyString('Honeypot', 255);

const publicConvertBodySchema = z.object({
  url: httpUrlSchema('URL'),
  companySlug: requiredTrimmedString('Slug da empresa', 80),
  employeeSlug: optionalNonEmptyString('Slug do colaborador', 80),
  honeypot: optionalHoneypotSchema,
  website: optionalHoneypotSchema,
  email_alt: optionalHoneypotSchema
});

type PublicSlugParams = z.infer<typeof publicSlugParamSchema>;
type PublicConvertBody = z.infer<typeof publicConvertBodySchema>;

export { publicConvertBodySchema, publicSlugParamSchema };
export type { PublicConvertBody, PublicSlugParams };
