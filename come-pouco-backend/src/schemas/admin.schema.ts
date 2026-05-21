import { z } from 'zod';

import { AUDIT_EVENT_TYPES } from '../constants/audit-events';
import {
  nullableString,
  optionalPositiveIdQuerySchema,
  paginationQueryShape,
  requiredTrimmedString
} from './common.schema';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PROVIDERS = ['smtp', 'resend', 'sendgrid', 'ses', 'mailgun'] as const;
const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const INCIDENT_STATUSES = ['investigating', 'identified', 'resolved'] as const;
const INCIDENT_COMPONENTS = ['backend', 'database', 'shopee', 'email', 'cache'] as const;

const optionalDateQuerySchema = (fieldLabel: string, endOfDay = false) =>
  z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .trim()
      .optional()
      .transform((value, ctx) => {
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

const requiredDateQuerySchema = (fieldLabel: string, endOfDay = false) =>
  z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .trim()
      .min(1)
      .transform((value, ctx) => {
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

const apiUsageModeSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim().length ? value.trim().toUpperCase() : undefined,
  z.enum(['MOCK', 'REAL']).optional()
);

const apiUsageQuerySchema = z
  .object({
    companyId: optionalPositiveIdQuerySchema('companyId'),
    userId: optionalPositiveIdQuerySchema('userId'),
    startDate: optionalDateQuerySchema('startDate'),
    endDate: optionalDateQuerySchema('endDate', true),
    mode: apiUsageModeSchema,
    ...paginationQueryShape
  })
  .refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
    message: 'startDate deve ser menor ou igual a endDate.',
    path: ['startDate']
  });

const deleteMockApiUsageQuerySchema = z
  .object({
    companyId: optionalPositiveIdQuerySchema('companyId'),
    startDate: optionalDateQuerySchema('startDate'),
    endDate: optionalDateQuerySchema('endDate', true)
  })
  .refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
    message: 'startDate deve ser menor ou igual a endDate.',
    path: ['startDate']
  });

const conversionAnonymizeQuerySchema = z.object({
  olderThan: requiredDateQuerySchema('olderThan', true)
});

const auditLogQuerySchema = z
  .object({
    eventType: z.preprocess(
      (value) =>
        typeof value === 'string' && value.trim().length ? value.trim().toUpperCase() : undefined,
      z.enum(AUDIT_EVENT_TYPES).optional()
    ),
    userId: optionalPositiveIdQuerySchema('userId'),
    startDate: optionalDateQuerySchema('startDate'),
    endDate: optionalDateQuerySchema('endDate', true),
    ...paginationQueryShape
  })
  .refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
    message: 'startDate deve ser menor ou igual a endDate.',
    path: ['startDate']
  });

const normalizeLowercaseString = (value: unknown): unknown =>
  typeof value === 'string' && value.trim().length ? value.trim().toLowerCase() : value;

const incidentSeveritySchema = z.preprocess(normalizeLowercaseString, z.enum(INCIDENT_SEVERITIES));
const incidentStatusSchema = z.preprocess(normalizeLowercaseString, z.enum(INCIDENT_STATUSES));
const incidentComponentSchema = z.preprocess(normalizeLowercaseString, z.enum(INCIDENT_COMPONENTS));

const incidentDateBodySchema = (fieldLabel: string) =>
  z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z
      .string()
      .trim()
      .optional()
      .transform((value, ctx) => {
        if (!value) {
          return undefined;
        }

        const parsed = new Date(value);

        if (Number.isNaN(parsed.getTime())) {
          ctx.addIssue({ code: 'custom', message: `${fieldLabel} invalida.` });
          return z.NEVER;
        }

        return parsed;
      })
  );

const incidentComponentsBodySchema = z
  .array(incidentComponentSchema)
  .min(1, 'Informe ao menos um componente afetado.')
  .max(INCIDENT_COMPONENTS.length, 'Componentes afetados invalidos.')
  .transform((components) => Array.from(new Set(components)));

const incidentIdParamsSchema = z.object({
  id: z.string().uuid('ID do incidente invalido.')
});

const incidentQuerySchema = z
  .object({
    status: z.preprocess(normalizeLowercaseString, z.enum(INCIDENT_STATUSES).optional()),
    severity: z.preprocess(normalizeLowercaseString, z.enum(INCIDENT_SEVERITIES).optional()),
    component: z.preprocess(normalizeLowercaseString, z.enum(INCIDENT_COMPONENTS).optional()),
    startDate: optionalDateQuerySchema('startDate'),
    endDate: optionalDateQuerySchema('endDate', true),
    ...paginationQueryShape
  })
  .refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
    message: 'startDate deve ser menor ou igual a endDate.',
    path: ['startDate']
  });

const createIncidentBodySchema = z
  .object({
    title: requiredTrimmedString('Titulo', 160),
    description: requiredTrimmedString('Descricao', 2000),
    severity: incidentSeveritySchema.default('medium'),
    status: incidentStatusSchema.default('investigating'),
    affectedComponents: incidentComponentsBodySchema,
    startedAt: incidentDateBodySchema('startedAt'),
    resolvedAt: incidentDateBodySchema('resolvedAt')
  })
  .refine((value) => value.status === 'resolved' || !value.resolvedAt, {
    message: 'resolvedAt so deve ser informado para incidentes resolvidos.',
    path: ['resolvedAt']
  })
  .refine((value) => !value.resolvedAt || !value.startedAt || value.resolvedAt >= value.startedAt, {
    message: 'resolvedAt deve ser maior ou igual a startedAt.',
    path: ['resolvedAt']
  });

const updateIncidentBodySchema = z
  .object({
    title: requiredTrimmedString('Titulo', 160).optional(),
    description: requiredTrimmedString('Descricao', 2000).optional(),
    severity: incidentSeveritySchema.optional(),
    status: incidentStatusSchema.optional(),
    affectedComponents: incidentComponentsBodySchema.optional(),
    startedAt: incidentDateBodySchema('startedAt'),
    resolvedAt: incidentDateBodySchema('resolvedAt')
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Informe ao menos um campo para atualizar.'
  })
  .refine((value) => value.status === 'resolved' || !value.resolvedAt, {
    message: 'resolvedAt so deve ser informado para incidentes resolvidos.',
    path: ['resolvedAt']
  })
  .refine((value) => !value.resolvedAt || !value.startedAt || value.resolvedAt >= value.startedAt, {
    message: 'resolvedAt deve ser maior ou igual a startedAt.',
    path: ['resolvedAt']
  });

const providerSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.enum(EMAIL_PROVIDERS)
);

const updateEmailConfigBodySchema = z.object({
  provider: providerSchema,
  fromEmail: requiredTrimmedString('fromEmail', 255)
    .email('fromEmail invalido.')
    .transform((value) => value.toLowerCase()),
  fromName: nullableString('fromName', 160),
  enabled: z.boolean().optional(),
  smtpHost: nullableString('smtpHost', 255),
  smtpPort: z.preprocess(
    (value) => (value === '' || value === null ? null : value),
    z.coerce
      .number({ error: 'smtpPort invalido.' })
      .int('smtpPort invalido.')
      .positive('smtpPort invalido.')
      .max(65535, 'smtpPort invalido.')
      .nullable()
      .optional()
  ),
  smtpUser: nullableString('smtpUser', 255),
  smtpPassword: nullableString('smtpPassword', 2048),
  smtpSecure: z.boolean().nullable().optional(),
  resendApiKey: nullableString('resendApiKey', 2048),
  sendgridApiKey: nullableString('sendgridApiKey', 2048),
  sesAccessKey: nullableString('sesAccessKey', 2048),
  sesSecretKey: nullableString('sesSecretKey', 2048),
  sesRegion: nullableString('sesRegion', 100),
  mailgunApiKey: nullableString('mailgunApiKey', 2048),
  mailgunDomain: nullableString('mailgunDomain', 255)
});

type ApiUsageQuery = z.infer<typeof apiUsageQuerySchema>;
type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
type ConversionAnonymizeQuery = z.infer<typeof conversionAnonymizeQuerySchema>;
type CreateIncidentBody = z.infer<typeof createIncidentBodySchema>;
type DeleteMockApiUsageQuery = z.infer<typeof deleteMockApiUsageQuerySchema>;
type IncidentQuery = z.infer<typeof incidentQuerySchema>;
type UpdateIncidentBody = z.infer<typeof updateIncidentBodySchema>;
type UpdateEmailConfigBody = z.infer<typeof updateEmailConfigBodySchema>;

export {
  apiUsageQuerySchema,
  auditLogQuerySchema,
  conversionAnonymizeQuerySchema,
  createIncidentBodySchema,
  deleteMockApiUsageQuerySchema,
  incidentIdParamsSchema,
  incidentQuerySchema,
  updateEmailConfigBodySchema,
  updateIncidentBodySchema
};
export type {
  ApiUsageQuery,
  AuditLogQuery,
  ConversionAnonymizeQuery,
  CreateIncidentBody,
  DeleteMockApiUsageQuery,
  IncidentQuery,
  UpdateEmailConfigBody,
  UpdateIncidentBody
};
