import type { Prisma } from '@prisma/client';

import prisma from '../config/prisma';
import {
  decryptNullableSecret,
  encryptSecret,
  isMaskedSecretValue,
  maskSecret
} from '../utils/encryption';
import HttpError from '../utils/httpError';

type EmailProvider = 'smtp' | 'resend' | 'sendgrid' | 'ses' | 'mailgun';

type EmailConfigUpdateInput = {
  provider: EmailProvider;
  fromEmail: string;
  fromName?: string | null;
  enabled?: boolean;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  smtpSecure?: boolean | null;
  resendApiKey?: string | null;
  sendgridApiKey?: string | null;
  sesAccessKey?: string | null;
  sesSecretKey?: string | null;
  sesRegion?: string | null;
  mailgunApiKey?: string | null;
  mailgunDomain?: string | null;
};

const RETAINED_SECRET_KEYS = [
  'smtpPassword',
  'resendApiKey',
  'sendgridApiKey',
  'sesAccessKey',
  'sesSecretKey',
  'mailgunApiKey'
] as const;

const ENCRYPTED_SECRET_KEYS = [
  'smtpPassword',
  'resendApiKey',
  'sendgridApiKey',
  'sesSecretKey',
  'mailgunApiKey'
] as const;
const encryptedSecretKeySet = new Set<string>(ENCRYPTED_SECRET_KEYS);

const DEFAULT_CONFIG: Prisma.SystemEmailConfigUncheckedCreateInput = {
  id: 1,
  provider: 'smtp',
  fromEmail: 'no-reply@auralinks.local',
  fromName: 'auralinks',
  enabled: false
};

const EMAIL_PROVIDER_LIST: ReadonlyArray<EmailProvider> = [
  'smtp',
  'resend',
  'sendgrid',
  'ses',
  'mailgun'
];

const ensureConfig = async () => {
  const existing = await prisma.systemEmailConfig.findUnique({ where: { id: 1 } });
  if (existing) {
    return existing;
  }

  return prisma.systemEmailConfig.create({ data: DEFAULT_CONFIG });
};

const decryptEmailConfig = (config: Awaited<ReturnType<typeof ensureConfig>>) => ({
  ...config,
  smtpPassword: decryptNullableSecret(config.smtpPassword),
  resendApiKey: decryptNullableSecret(config.resendApiKey),
  sendgridApiKey: decryptNullableSecret(config.sendgridApiKey),
  sesSecretKey: decryptNullableSecret(config.sesSecretKey),
  mailgunApiKey: decryptNullableSecret(config.mailgunApiKey)
});

const getEmailConfig = async () => {
  const config = decryptEmailConfig(await ensureConfig());

  return {
    ...config,
    smtpPassword: maskSecret(config.smtpPassword),
    resendApiKey: maskSecret(config.resendApiKey),
    sendgridApiKey: maskSecret(config.sendgridApiKey),
    sesAccessKey: maskSecret(config.sesAccessKey),
    sesSecretKey: maskSecret(config.sesSecretKey),
    mailgunApiKey: maskSecret(config.mailgunApiKey)
  };
};

const normalizeOptional = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const isProvider = (provider: string): provider is EmailProvider =>
  EMAIL_PROVIDER_LIST.includes(provider as EmailProvider);

const validateConfigByProvider = (
  provider: EmailProvider,
  data: Prisma.SystemEmailConfigUncheckedUpdateInput | Prisma.SystemEmailConfigUncheckedCreateInput
): void => {
  if (!isProvider(provider)) {
    throw new HttpError(400, 'Provider de e-mail invalido.');
  }

  if (!String(data.fromEmail || '').trim().length) {
    throw new HttpError(400, 'fromEmail e obrigatorio.');
  }

  const requiredFieldsByProvider: Record<EmailProvider, Array<keyof EmailConfigUpdateInput>> = {
    smtp: ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'fromEmail'],
    resend: ['resendApiKey', 'fromEmail'],
    sendgrid: ['sendgridApiKey', 'fromEmail'],
    ses: ['sesAccessKey', 'sesSecretKey', 'sesRegion', 'fromEmail'],
    mailgun: ['mailgunApiKey', 'mailgunDomain', 'fromEmail']
  };

  const requiredFields = requiredFieldsByProvider[provider];

  requiredFields.forEach((field) => {
    const value = data[field];
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim().length === 0)
    ) {
      throw new HttpError(400, `Campo obrigatorio para provider ${provider}: ${field}.`);
    }
  });

  if (data.smtpPort !== undefined && data.smtpPort !== null) {
    const smtpPort = Number(data.smtpPort);
    if (!Number.isInteger(smtpPort) || smtpPort <= 0) {
      throw new HttpError(400, 'smtpPort invalido.');
    }
  }
};

const buildUpdateData = (
  payload: EmailConfigUpdateInput,
  current: Awaited<ReturnType<typeof ensureConfig>>
) => {
  const data: Prisma.SystemEmailConfigUncheckedUpdateInput = {
    provider: payload.provider,
    fromEmail: payload.fromEmail.trim().toLowerCase(),
    fromName: normalizeOptional(payload.fromName) ?? null,
    enabled: payload.enabled ?? true,
    smtpHost: normalizeOptional(payload.smtpHost) ?? null,
    smtpPort: payload.smtpPort ?? null,
    smtpUser: normalizeOptional(payload.smtpUser) ?? null,
    smtpSecure: payload.smtpSecure ?? false,
    sesRegion: normalizeOptional(payload.sesRegion) ?? null,
    mailgunDomain: normalizeOptional(payload.mailgunDomain) ?? null
  };

  RETAINED_SECRET_KEYS.forEach((key) => {
    const incoming = payload[key];

    if (incoming === undefined || incoming === null || incoming.trim().length === 0) {
      data[key] = current[key];
      return;
    }

    const normalized = incoming.trim();

    if (isMaskedSecretValue(normalized) && current[key]) {
      data[key] = current[key];
      return;
    }

    data[key] = encryptedSecretKeySet.has(key) ? encryptSecret(normalized) : normalized;
  });

  return data;
};

const updateEmailConfig = async (payload: EmailConfigUpdateInput) => {
  const current = await ensureConfig();
  const data = buildUpdateData(payload, current);
  validateConfigByProvider(payload.provider, data);
  await prisma.systemEmailConfig.update({
    where: { id: 1 },
    data
  });

  return getEmailConfig();
};

const getRawEmailConfig = async () => decryptEmailConfig(await ensureConfig());

export { EMAIL_PROVIDER_LIST, getEmailConfig, getRawEmailConfig, isProvider, updateEmailConfig };
export type { EmailConfigUpdateInput, EmailProvider };
