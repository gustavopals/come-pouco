import { NextFunction, Request, Response } from 'express';

import { createLead } from '../services/lead.service';
import HttpError from '../utils/httpError';

const createLeadHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = req.body as {
      name: string;
      email: string;
      volume?: string;
      message?: string;
      website?: string;
    };

    if (body.website && body.website.length > 0) {
      // Honeypot: spam silenciosamente aceito mas não persistido.
      res.status(202).json({ ok: true });
      return;
    }

    const lead = await createLead({
      name: body.name,
      email: body.email,
      volume: body.volume,
      message: body.message,
      ipAddress: req.ip ?? undefined,
      userAgent:
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent'].slice(0, 500)
          : undefined
    });

    res.status(201).json({ ok: true, id: lead.id });
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
      return;
    }

    next(new HttpError(500, 'Falha ao registrar lead.', 'LEAD_CREATE_FAILED'));
  }
};

export { createLeadHandler };
