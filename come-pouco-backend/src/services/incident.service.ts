import {
  IncidentSeverity as PrismaIncidentSeverity,
  IncidentStatus as PrismaIncidentStatus,
  Prisma
} from '@prisma/client';

import prisma from '../config/prisma';
import { getReadiness, type ComponentCheck, type HealthStatus } from './health.service';
import HttpError from '../utils/httpError';
import { PaginationInput, normalizePagination, toPaginatedResult } from '../utils/pagination';

type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
type IncidentStatus = 'investigating' | 'identified' | 'resolved';
type IncidentComponent = 'backend' | 'database' | 'shopee' | 'email' | 'cache';

interface IncidentMutationInput {
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedComponents: IncidentComponent[];
  startedAt?: Date;
  resolvedAt?: Date;
}

interface IncidentUpdateInput {
  title?: string;
  description?: string;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  affectedComponents?: IncidentComponent[];
  startedAt?: Date;
  resolvedAt?: Date;
}

interface IncidentQueryInput {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  component?: IncidentComponent;
  startDate?: Date;
  endDate?: Date;
  pagination?: PaginationInput;
}

interface StatusComponentOutput {
  key: IncidentComponent;
  label: string;
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  activeIncidentCount: number;
}

interface IncidentTimelineItem {
  date: string;
  incidentCount: number;
  activeIncidentCount: number;
  highestSeverity: IncidentSeverity | null;
}

const severityToPrisma: Record<IncidentSeverity, PrismaIncidentSeverity> = {
  low: PrismaIncidentSeverity.LOW,
  medium: PrismaIncidentSeverity.MEDIUM,
  high: PrismaIncidentSeverity.HIGH,
  critical: PrismaIncidentSeverity.CRITICAL
};

const severityFromPrisma: Record<PrismaIncidentSeverity, IncidentSeverity> = {
  [PrismaIncidentSeverity.LOW]: 'low',
  [PrismaIncidentSeverity.MEDIUM]: 'medium',
  [PrismaIncidentSeverity.HIGH]: 'high',
  [PrismaIncidentSeverity.CRITICAL]: 'critical'
};

const statusToPrisma: Record<IncidentStatus, PrismaIncidentStatus> = {
  investigating: PrismaIncidentStatus.INVESTIGATING,
  identified: PrismaIncidentStatus.IDENTIFIED,
  resolved: PrismaIncidentStatus.RESOLVED
};

const statusFromPrisma: Record<PrismaIncidentStatus, IncidentStatus> = {
  [PrismaIncidentStatus.INVESTIGATING]: 'investigating',
  [PrismaIncidentStatus.IDENTIFIED]: 'identified',
  [PrismaIncidentStatus.RESOLVED]: 'resolved'
};

const severityRank: Record<IncidentSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const componentLabels: Record<IncidentComponent, string> = {
  backend: 'Backend',
  database: 'Database',
  shopee: 'Shopee API',
  email: 'Email Transport',
  cache: 'Cache'
};

const toIso = (date: Date | null): string | null => (date ? date.toISOString() : null);

const toIncidentOutput = (incident: Prisma.IncidentGetPayload<object>) => ({
  id: incident.id,
  title: incident.title,
  description: incident.description,
  severity: severityFromPrisma[incident.severity],
  status: statusFromPrisma[incident.status],
  affectedComponents: Array.isArray(incident.affectedComponents)
    ? (incident.affectedComponents.filter(
        (component) => typeof component === 'string'
      ) as IncidentComponent[])
    : [],
  startedAt: incident.startedAt.toISOString(),
  resolvedAt: toIso(incident.resolvedAt),
  createdAt: incident.createdAt.toISOString(),
  updatedAt: incident.updatedAt.toISOString()
});

const normalizeAffectedComponents = (components: IncidentComponent[]): IncidentComponent[] =>
  Array.from(new Set(components));

const buildIncidentWhere = ({
  status,
  severity,
  component,
  startDate,
  endDate
}: Omit<IncidentQueryInput, 'pagination'>): Prisma.IncidentWhereInput => ({
  status: status ? statusToPrisma[status] : undefined,
  severity: severity ? severityToPrisma[severity] : undefined,
  affectedComponents: component ? { array_contains: [component] } : undefined,
  startedAt:
    startDate || endDate
      ? {
          gte: startDate,
          lte: endDate
        }
      : undefined
});

const listIncidents = async ({ pagination: paginationInput, ...filters }: IncidentQueryInput) => {
  const pagination = normalizePagination(paginationInput);
  const where = buildIncidentWhere(filters);

  const [total, incidents] = await prisma.$transaction([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
      skip: pagination.skip,
      take: pagination.take
    })
  ]);

  const result = toPaginatedResult(incidents.map(toIncidentOutput), total, pagination);

  return {
    incidents: result.items,
    data: result.data,
    items: result.items,
    meta: result.meta
  };
};

const createIncident = async (input: IncidentMutationInput) => {
  const status = statusToPrisma[input.status];
  const incident = await prisma.incident.create({
    data: {
      title: input.title,
      description: input.description,
      severity: severityToPrisma[input.severity],
      status,
      affectedComponents: normalizeAffectedComponents(input.affectedComponents),
      startedAt: input.startedAt ?? new Date(),
      resolvedAt: status === PrismaIncidentStatus.RESOLVED ? (input.resolvedAt ?? new Date()) : null
    }
  });

  return toIncidentOutput(incident);
};

const updateIncident = async (id: string, input: IncidentUpdateInput) => {
  const existing = await prisma.incident.findUnique({ where: { id } });

  if (!existing) {
    throw new HttpError(404, 'Incidente nao encontrado.', 'INCIDENT_NOT_FOUND');
  }

  const nextStatus = input.status ? statusToPrisma[input.status] : existing.status;
  const data: Prisma.IncidentUpdateInput = {
    title: input.title,
    description: input.description,
    severity: input.severity ? severityToPrisma[input.severity] : undefined,
    status: input.status ? statusToPrisma[input.status] : undefined,
    affectedComponents: input.affectedComponents
      ? normalizeAffectedComponents(input.affectedComponents)
      : undefined,
    startedAt: input.startedAt
  };

  if (nextStatus === PrismaIncidentStatus.RESOLVED) {
    data.resolvedAt = input.resolvedAt ?? existing.resolvedAt ?? new Date();
  } else if (input.status && input.status !== 'resolved') {
    data.resolvedAt = null;
  }

  const incident = await prisma.incident.update({
    where: { id },
    data
  });

  return toIncidentOutput(incident);
};

const deleteIncident = async (id: string): Promise<void> => {
  const existing = await prisma.incident.findUnique({ where: { id }, select: { id: true } });

  if (!existing) {
    throw new HttpError(404, 'Incidente nao encontrado.', 'INCIDENT_NOT_FOUND');
  }

  await prisma.incident.delete({ where: { id } });
};

const getIncident = async (id: string) => {
  const incident = await prisma.incident.findUnique({ where: { id } });

  if (!incident) {
    throw new HttpError(404, 'Incidente nao encontrado.', 'INCIDENT_NOT_FOUND');
  }

  return toIncidentOutput(incident);
};

const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const addUtcDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const getHighestSeverity = (
  incidents: Array<ReturnType<typeof toIncidentOutput>>
): IncidentSeverity | null => {
  return incidents.reduce<IncidentSeverity | null>((highest, incident) => {
    if (!highest || severityRank[incident.severity] > severityRank[highest]) {
      return incident.severity;
    }

    return highest;
  }, null);
};

const buildTimeline = (
  incidents: Array<ReturnType<typeof toIncidentOutput>>,
  now = new Date()
): IncidentTimelineItem[] => {
  const today = startOfUtcDay(now);
  const firstDay = addUtcDays(today, -6);

  return Array.from({ length: 7 }).map((_, index) => {
    const dayStart = addUtcDays(firstDay, index);
    const dayEnd = addUtcDays(dayStart, 1);
    const dayIncidents = incidents.filter((incident) => {
      const startedAt = new Date(incident.startedAt);
      return startedAt >= dayStart && startedAt < dayEnd;
    });
    const activeIncidentCount = dayIncidents.filter(
      (incident) => incident.status !== 'resolved'
    ).length;

    return {
      date: dayStart.toISOString().slice(0, 10),
      incidentCount: dayIncidents.length,
      activeIncidentCount,
      highestSeverity: getHighestSeverity(dayIncidents)
    };
  });
};

const applyIncidentOverlay = (
  status: HealthStatus,
  incidents: Array<ReturnType<typeof toIncidentOutput>>
): HealthStatus => {
  if (status === 'down') {
    return status;
  }

  if (incidents.some((incident) => incident.severity === 'critical')) {
    return 'down';
  }

  if (incidents.length > 0 || status === 'degraded') {
    return 'degraded';
  }

  return 'ok';
};

const toComponentOutput = (
  key: IncidentComponent,
  check: ComponentCheck,
  activeIncidents: Array<ReturnType<typeof toIncidentOutput>>
): StatusComponentOutput => ({
  key,
  label: componentLabels[key],
  status: applyIncidentOverlay(check.status, activeIncidents),
  latencyMs: check.latencyMs,
  message: activeIncidents.length
    ? `${activeIncidents.length} incidente(s) ativo(s)`
    : check.message,
  activeIncidentCount: activeIncidents.length
});

const getOverallStatus = (components: StatusComponentOutput[]): HealthStatus => {
  if (components.some((component) => component.status === 'down')) {
    return 'down';
  }

  if (components.some((component) => component.status === 'degraded')) {
    return 'degraded';
  }

  return 'ok';
};

const getAdminStatus = async () => {
  const readiness = await getReadiness();
  const since = addUtcDays(startOfUtcDay(new Date()), -6);
  const [recentIncidents, activeIncidents] = await Promise.all([
    prisma.incident.findMany({
      where: {
        OR: [{ startedAt: { gte: since } }, { status: { not: PrismaIncidentStatus.RESOLVED } }]
      },
      orderBy: { startedAt: 'desc' },
      take: 100
    }),
    prisma.incident.findMany({
      where: { status: { not: PrismaIncidentStatus.RESOLVED } },
      orderBy: [{ severity: 'desc' }, { startedAt: 'desc' }],
      take: 50
    })
  ]);

  const recentIncidentOutputs = recentIncidents.map(toIncidentOutput);
  const activeIncidentOutputs = activeIncidents.map(toIncidentOutput);
  const activeByComponent = (component: IncidentComponent) =>
    activeIncidentOutputs.filter((incident) => incident.affectedComponents.includes(component));
  const backendCheck: ComponentCheck = {
    status: 'ok',
    message: `uptime ${readiness.uptime}s`
  };
  const components = [
    toComponentOutput('backend', backendCheck, activeByComponent('backend')),
    toComponentOutput('database', readiness.checks.database, activeByComponent('database')),
    toComponentOutput('shopee', readiness.checks.shopee, activeByComponent('shopee')),
    toComponentOutput('email', readiness.checks.email, activeByComponent('email')),
    toComponentOutput('cache', readiness.checks.cache, activeByComponent('cache'))
  ];

  return {
    generatedAt: new Date().toISOString(),
    overallStatus: getOverallStatus(components),
    health: readiness,
    components,
    timeline: buildTimeline(recentIncidentOutputs),
    incidents: recentIncidentOutputs,
    activeIncidents: activeIncidentOutputs
  };
};

export {
  createIncident,
  deleteIncident,
  getAdminStatus,
  getIncident,
  listIncidents,
  updateIncident
};
export type {
  IncidentComponent,
  IncidentMutationInput,
  IncidentQueryInput,
  IncidentSeverity,
  IncidentStatus,
  IncidentUpdateInput
};
