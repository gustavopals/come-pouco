import { publicCache } from '../cache/public.cache';
import env from '../config/env';
import prisma from '../config/prisma';
import { recordDbHealthLatency } from '../lib/metrics';

type HealthStatus = 'ok' | 'degraded' | 'down';

interface ComponentCheck {
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  skipped?: boolean;
  details?: Record<string, unknown>;
}

interface HealthResponse {
  status: HealthStatus;
  uptime: number;
  version: string;
  timestamp: string;
}

interface ReadinessResponse extends HealthResponse {
  checks: {
    database: ComponentCheck;
    shopee: ComponentCheck;
    email: ComponentCheck;
    cache: ComponentCheck;
  };
}

type EmailProvider = 'smtp' | 'resend' | 'sendgrid' | 'ses' | 'mailgun';

const EMAIL_REQUIRED_FIELDS: Record<EmailProvider, string[]> = {
  smtp: ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'fromEmail'],
  resend: ['resendApiKey', 'fromEmail'],
  sendgrid: ['sendgridApiKey', 'fromEmail'],
  ses: ['sesAccessKey', 'sesSecretKey', 'sesRegion', 'fromEmail'],
  mailgun: ['mailgunApiKey', 'mailgunDomain', 'fromEmail']
};

const EMAIL_PROVIDERS = new Set<EmailProvider>(['smtp', 'resend', 'sendgrid', 'ses', 'mailgun']);

const getBaseHealth = (): HealthResponse => ({
  status: 'ok',
  uptime: Math.floor(process.uptime()),
  version: env.appVersion,
  timestamp: new Date().toISOString()
});

const measure = async <T>(
  operation: () => Promise<T>
): Promise<{ result: T; latencyMs: number }> => {
  const startedAt = performance.now();
  const result = await operation();
  return {
    result,
    latencyMs: Math.round(performance.now() - startedAt)
  };
};

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'erro desconhecido';

const isPresent = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
};

const checkDatabase = async (): Promise<ComponentCheck> => {
  try {
    const { latencyMs } = await measure(async () => {
      await prisma.$queryRaw`SELECT 1`;
    });
    recordDbHealthLatency(latencyMs);

    if (latencyMs > env.health.databaseLatencyWarnMs) {
      return {
        status: 'degraded',
        latencyMs,
        message: `latencia acima de ${env.health.databaseLatencyWarnMs}ms`
      };
    }

    return { status: 'ok', latencyMs };
  } catch (error) {
    return {
      status: 'down',
      message: toErrorMessage(error)
    };
  }
};

const createTimeoutSignal = (timeoutMs: number): { signal: AbortSignal; cleanup: () => void } => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeout)
  };
};

const checkShopee = async (): Promise<ComponentCheck> => {
  if (!env.health.shopeeEnabled) {
    return {
      status: 'ok',
      skipped: true,
      message: 'check desabilitado'
    };
  }

  const { signal, cleanup } = createTimeoutSignal(env.health.shopeeTimeoutMs);

  try {
    const { result: response, latencyMs } = await measure(() =>
      fetch(env.health.shopeeUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal
      })
    );

    if (response.status >= 500) {
      return {
        status: 'degraded',
        latencyMs,
        message: `Shopee respondeu HTTP ${response.status}`,
        details: {
          statusCode: response.status
        }
      };
    }

    return {
      status: 'ok',
      latencyMs,
      details: {
        statusCode: response.status
      }
    };
  } catch (error) {
    return {
      status: 'degraded',
      message: toErrorMessage(error)
    };
  } finally {
    cleanup();
  }
};

const checkEmail = async (): Promise<ComponentCheck> => {
  try {
    const { result: config, latencyMs } = await measure(() =>
      prisma.systemEmailConfig.findUnique({ where: { id: 1 } })
    );

    if (!config) {
      return {
        status: 'degraded',
        latencyMs,
        message: 'configuracao de email nao encontrada'
      };
    }

    const provider = String(config.provider || '').toLowerCase();

    if (!EMAIL_PROVIDERS.has(provider as EmailProvider)) {
      return {
        status: 'degraded',
        latencyMs,
        message: 'provider de email invalido',
        details: {
          provider,
          enabled: Boolean(config.enabled)
        }
      };
    }

    if (!config.enabled) {
      return {
        status: 'degraded',
        latencyMs,
        message: 'transporte de email desabilitado',
        details: {
          provider,
          enabled: false
        }
      };
    }

    const missingFields = EMAIL_REQUIRED_FIELDS[provider as EmailProvider].filter(
      (field) => !isPresent(config[field as keyof typeof config])
    );

    if (missingFields.length) {
      return {
        status: 'degraded',
        latencyMs,
        message: 'configuracao de email incompleta',
        details: {
          provider,
          enabled: true,
          missingFields
        }
      };
    }

    return {
      status: 'ok',
      latencyMs,
      details: {
        provider,
        enabled: true
      }
    };
  } catch (error) {
    return {
      status: 'degraded',
      message: toErrorMessage(error)
    };
  }
};

const checkCache = async (): Promise<ComponentCheck> => {
  const stats = publicCache.stats();
  const totalRequests = stats.hits + stats.misses;
  const hitRatio = totalRequests > 0 ? Number((stats.hits / totalRequests).toFixed(4)) : null;

  return {
    status: 'ok',
    details: {
      ...stats,
      hitRatio
    }
  };
};

const aggregateReadinessStatus = (checks: ReadinessResponse['checks']): HealthStatus => {
  if (checks.database.status === 'down') {
    return 'down';
  }

  if (Object.values(checks).some((check) => check.status !== 'ok')) {
    return 'degraded';
  }

  return 'ok';
};

const getLiveness = (): HealthResponse => getBaseHealth();

const getReadiness = async (): Promise<ReadinessResponse> => {
  const [database, shopee, email, cache] = await Promise.all([
    checkDatabase(),
    checkShopee(),
    checkEmail(),
    checkCache()
  ]);
  const checks = { database, shopee, email, cache };

  return {
    ...getBaseHealth(),
    status: aggregateReadinessStatus(checks),
    checks
  };
};

export { getLiveness, getReadiness };
export type { ComponentCheck, HealthResponse, HealthStatus, ReadinessResponse };
