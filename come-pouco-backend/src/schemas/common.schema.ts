import { z } from 'zod';

import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../utils/pagination';

const USERNAME_PATTERN = /^[a-z0-9_-]+$/;
const SUB_ID1_PATTERN = /^[A-Za-z0-9_-]+$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);
const emptyToNull = (value: unknown): unknown => (value === '' ? null : value);

const trimmedString = z.string().trim();

const requiredTrimmedString = (fieldLabel: string, maxLength = 255) =>
  trimmedString
    .min(1, `${fieldLabel} e obrigatorio.`)
    .max(maxLength, `${fieldLabel} deve ter no maximo ${maxLength} caracteres.`);

const optionalNonEmptyString = (fieldLabel: string, maxLength = 255) =>
  z.preprocess(
    emptyToUndefined,
    trimmedString
      .min(1, `${fieldLabel} invalido(a).`)
      .max(maxLength, `${fieldLabel} deve ter no maximo ${maxLength} caracteres.`)
      .optional()
  );

const nullableString = (fieldLabel: string, maxLength = 255) =>
  z.preprocess(
    emptyToNull,
    trimmedString
      .max(maxLength, `${fieldLabel} deve ter no maximo ${maxLength} caracteres.`)
      .nullable()
      .optional()
  );

const httpUrlSchema = (fieldLabel: string) =>
  trimmedString
    .min(1, `${fieldLabel} e obrigatorio.`)
    .url(`${fieldLabel} deve ser uma URL valida.`)
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, `${fieldLabel} deve usar http ou https.`);

const optionalHttpUrlSchema = (fieldLabel: string) =>
  z.preprocess(emptyToUndefined, httpUrlSchema(fieldLabel).optional());

const positiveIdSchema = (fieldLabel = 'ID') =>
  z.coerce
    .number({ error: `${fieldLabel} invalido.` })
    .int(`${fieldLabel} invalido.`)
    .positive(`${fieldLabel} invalido.`);

const nullablePositiveIdSchema = (fieldLabel = 'ID') =>
  z.preprocess(emptyToNull, z.union([positiveIdSchema(fieldLabel), z.null()]).optional());

const idParamsSchema = z.object({
  id: positiveIdSchema('ID')
});

const optionalPositiveIdQuerySchema = (fieldLabel = 'ID') =>
  z.preprocess(emptyToUndefined, positiveIdSchema(fieldLabel).optional());

const optionalDateQuerySchema = (fieldLabel: string, endOfDay = false) =>
  z.preprocess(
    emptyToUndefined,
    trimmedString.optional().transform((value, ctx) => {
      if (!value) {
        return undefined;
      }

      if (DATE_ONLY_PATTERN.test(value)) {
        return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
      }

      const parsed = new Date(value);

      if (Number.isNaN(parsed.getTime())) {
        ctx.addIssue({ code: 'custom', message: `${fieldLabel} invalida.` });
        return z.NEVER;
      }

      return parsed;
    })
  );

const optionalPositiveIntegerQuerySchema = (
  fieldLabel: string,
  defaultValue: number,
  maxValue?: number
) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: `${fieldLabel} invalido.` })
      .int(`${fieldLabel} invalido.`)
      .positive(`${fieldLabel} invalido.`)
      .max(maxValue ?? Number.MAX_SAFE_INTEGER, `${fieldLabel} invalido.`)
      .default(defaultValue)
  );

const paginationQueryShape = {
  page: optionalPositiveIntegerQuerySchema('page', DEFAULT_PAGE),
  limit: optionalPositiveIntegerQuerySchema('limit', DEFAULT_LIMIT, MAX_LIMIT)
};

const usernameSchema = requiredTrimmedString('Username', 120)
  .transform((value) => value.toLowerCase())
  .refine(
    (value) => USERNAME_PATTERN.test(value),
    'Username invalido. Use apenas letras, numeros, _ ou -.'
  );

const emailSchema = z.preprocess(
  emptyToUndefined,
  trimmedString
    .email('E-mail invalido.')
    .max(255, 'E-mail deve ter no maximo 255 caracteres.')
    .transform((value) => value.toLowerCase())
    .optional()
);

const nullableEmailSchema = z.preprocess(
  emptyToNull,
  trimmedString
    .email('E-mail invalido.')
    .max(255, 'E-mail deve ter no maximo 255 caracteres.')
    .transform((value) => value.toLowerCase())
    .nullable()
    .optional()
);

const strongPasswordSchema = trimmedString
  .min(10, 'A senha deve ter no minimo 10 caracteres.')
  .max(128, 'A senha deve ter no maximo 128 caracteres.')
  .refine((value) => !/\s/.test(value), 'A senha nao pode conter espacos.')
  .refine((value) => /[A-Za-z]/.test(value), 'A senha deve conter ao menos 1 letra.')
  .refine((value) => /\d/.test(value), 'A senha deve conter ao menos 1 numero.')
  .refine((value) => !/(.)\1{2,}/.test(value), 'A senha nao pode conter repeticoes obvias.')
  .refine((value) => {
    const normalized = value.toLowerCase();
    return !['123456', 'abcdef', 'qwerty', 'password', 'senha'].some((pattern) =>
      normalized.includes(pattern)
    );
  }, 'A senha nao pode conter sequencias ou palavras obvias.');

const optionalStrongPasswordSchema = z.preprocess(
  emptyToUndefined,
  strongPasswordSchema.optional()
);

const currentPasswordSchema = trimmedString
  .min(1, 'Senha e obrigatoria.')
  .max(128, 'Senha deve ter no maximo 128 caracteres.');

const subId1CreateSchema = z
  .preprocess(
    emptyToNull,
    trimmedString
      .max(50, 'subId1 deve ter no maximo 50 caracteres.')
      .regex(SUB_ID1_PATTERN, 'subId1 invalido. Use apenas letras, numeros, underscore e hifen.')
      .nullable()
      .optional()
  )
  .transform((value) => value ?? null);

const subId1UpdateSchema = z.preprocess(
  emptyToNull,
  trimmedString
    .max(50, 'subId1 deve ter no maximo 50 caracteres.')
    .regex(SUB_ID1_PATTERN, 'subId1 invalido. Use apenas letras, numeros, underscore e hifen.')
    .nullable()
    .optional()
);

const sixDigitCodeSchema = trimmedString.regex(/^\d{6}$/, 'Codigo deve conter 6 digitos.');
const twoFactorOrBackupCodeSchema = trimmedString
  .min(1, 'Codigo e obrigatorio.')
  .max(32, 'Codigo deve ter no maximo 32 caracteres.');

export {
  currentPasswordSchema,
  emailSchema,
  httpUrlSchema,
  idParamsSchema,
  nullableEmailSchema,
  nullablePositiveIdSchema,
  nullableString,
  optionalPositiveIntegerQuerySchema,
  optionalHttpUrlSchema,
  optionalNonEmptyString,
  optionalDateQuerySchema,
  optionalPositiveIdQuerySchema,
  paginationQueryShape,
  optionalStrongPasswordSchema,
  positiveIdSchema,
  requiredTrimmedString,
  sixDigitCodeSchema,
  strongPasswordSchema,
  subId1CreateSchema,
  subId1UpdateSchema,
  twoFactorOrBackupCodeSchema,
  usernameSchema
};
