import { Request } from 'express';
import rateLimit, { Options, RateLimitRequestHandler } from 'express-rate-limit';

interface BuildRateLimiterOptions {
  windowMs: number;
  limit: number;
  message: string;
  errorCode: string;
  keyGenerator?: Options['keyGenerator'];
  legacyHeaders?: Options['legacyHeaders'];
  standardHeaders?: Options['standardHeaders'];
  handler?: Options['handler'];
  requestPropertyName?: Options['requestPropertyName'];
  store?: Options['store'];
}

const buildRateLimiter = ({
  windowMs,
  limit,
  message,
  errorCode,
  keyGenerator,
  legacyHeaders = false,
  standardHeaders = 'draft-7',
  handler,
  requestPropertyName,
  store
}: BuildRateLimiterOptions): RateLimitRequestHandler => {
  return rateLimit({
    windowMs,
    limit,
    keyGenerator,
    standardHeaders,
    legacyHeaders,
    requestPropertyName,
    store,
    handler:
      handler ??
      ((_req, res) => {
        res.status(429).json({
          message,
          errorCode
        });
      })
  });
};

const buildAuthRateLimiter = buildRateLimiter;

const getAuthenticatedUserRateLimitKey = (req: Request): string => {
  if (req.userId) {
    return `user:${req.userId}`;
  }

  return `ip:${req.ip || 'unknown'}`;
};

const loginRateLimiter = buildAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: 'Muitas tentativas de login. Tente novamente em alguns minutos.',
  errorCode: 'RATE_LIMIT_AUTH_LOGIN'
});

const loginTwoFactorRateLimiter = buildAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Muitas tentativas de 2FA. Tente novamente em alguns minutos.',
  errorCode: 'RATE_LIMIT_AUTH_2FA'
});

const forgotPasswordRateLimiter = buildAuthRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  message: 'Muitas solicitacoes de recuperacao de senha. Tente novamente mais tarde.',
  errorCode: 'RATE_LIMIT_FORGOT_PASSWORD'
});

const shopeeShortlinkRateLimiter = buildAuthRateLimiter({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: getAuthenticatedUserRateLimitKey,
  message: 'Limite de geracao de links atingido. Tente novamente em alguns instantes.',
  errorCode: 'RATE_LIMIT_SHOPEE_SHORTLINKS'
});

export {
  buildRateLimiter,
  buildAuthRateLimiter,
  forgotPasswordRateLimiter,
  loginRateLimiter,
  loginTwoFactorRateLimiter,
  shopeeShortlinkRateLimiter
};
