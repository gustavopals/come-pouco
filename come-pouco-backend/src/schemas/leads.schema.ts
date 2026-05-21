import { z } from 'zod';

const trimmedString = z.string().trim();

const leadCreateSchema = z.object({
  name: trimmedString.min(2, 'Nome muito curto.').max(160, 'Nome muito longo.'),
  email: trimmedString
    .email('E-mail invalido.')
    .max(255, 'E-mail muito longo.')
    .transform((value) => value.toLowerCase()),
  volume: trimmedString.max(40, 'Volume invalido.').optional(),
  message: trimmedString.max(1000, 'Mensagem muito longa.').optional(),
  // honeypot
  website: trimmedString.max(0, 'Spam detectado.').optional()
});

type LeadCreateInput = z.infer<typeof leadCreateSchema>;

export { leadCreateSchema };
export type { LeadCreateInput };
