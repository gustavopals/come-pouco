import { NextFunction, Request, Response } from 'express';

import prisma from '../config/prisma';
import { slugifyPublicSlug } from '../config/reserved-slugs';
import {
  normalizePublicRateLimitIp,
  sanitizePublicReferrer,
  sanitizePublicUserAgent
} from '../middlewares/public-rate-limit.middleware';
import type { PublicConvertBody, PublicSlugParams } from '../schemas/public.schema';
import {
  convertPublicUrl,
  recordBotDetectedConversion
} from '../services/public-conversion.service';
import { hashIp } from '../utils/ip-hash';
import HttpError from '../utils/httpError';

const getPublicHealthz = (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok' });
};

const getLanding = async (
  req: Request<PublicSlugParams>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const publicSlug = slugifyPublicSlug(req.params.slug);
    const company = await prisma.company.findFirst({
      where: { publicSlug },
      select: {
        name: true,
        publicSlug: true,
        landingConfig: {
          select: {
            bannerText: true,
            bannerEmoji: true,
            heroTitle: true,
            heroSubtitle: true,
            howItWorksSteps: true,
            primaryColor: true,
            logoUrl: true,
            isActive: true
          }
        }
      }
    });

    if (!company?.landingConfig?.isActive) {
      throw new HttpError(404, 'Landing publica nao encontrada.', 'PUBLIC_LANDING_NOT_FOUND');
    }

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json({
      company: {
        name: company.name,
        publicSlug: company.publicSlug
      },
      landingConfig: company.landingConfig
    });
  } catch (error) {
    next(error);
  }
};

const convert = async (
  req: Request<Record<string, never>, unknown, PublicConvertBody>,
  res: Response
): Promise<void> => {
  const { url, companySlug, employeeSlug, honeypot, website, email_alt: emailAlt } = req.body;
  const requesterIp =
    req.publicRateLimitIp ??
    normalizePublicRateLimitIp(req.ip || req.socket.remoteAddress || 'unknown');
  const ipHash = req.publicIpHash ?? hashIp(requesterIp);
  const userAgent = req.publicUserAgent ?? sanitizePublicUserAgent(req.get('user-agent'));
  const referrer =
    req.publicReferrer ?? sanitizePublicReferrer(req.get('referer') || req.get('referrer'));
  const requestId = typeof req.id === 'string' ? req.id : req.id ? String(req.id) : undefined;

  try {
    if (isHoneypotFilled(honeypot, website, emailAlt)) {
      const fake = await recordBotDetectedConversion(
        {
          url,
          companySlug,
          ipHash,
          userAgent,
          referrer
        },
        {
          requestId,
          awaitPersistence: true
        }
      );

      res.status(200).json({
        status: 'success',
        affiliateUrl: fake.affiliateUrl,
        conversionId: fake.conversionId
      });
      return;
    }

    const result = await convertPublicUrl(
      {
        url,
        companySlug,
        employeeSlug,
        ipHash,
        userAgent,
        referrer
      },
      {
        requestId
      }
    );

    res.status(200).json({
      status: result.status.toLowerCase(),
      affiliateUrl: result.affiliateUrl,
      conversionId: result.conversionId
    });
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    const errorCode =
      error instanceof HttpError
        ? error.errorCode || 'PUBLIC_CONVERT_ERROR'
        : 'PUBLIC_CONVERT_ERROR';

    res.status(statusCode).json({
      status: 'error',
      errorCode
    });
  }
};

const isHoneypotFilled = (...values: Array<string | undefined>): boolean =>
  values.some((value) => Boolean(value?.trim()));

export { convert, getLanding, getPublicHealthz };
