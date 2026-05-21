import { NextFunction, Request, Response } from 'express';

import prisma from '../config/prisma';
import { AUDIT_EVENTS } from '../constants/audit-events';
import type { UpdateEmailConfigBody } from '../schemas/admin.schema';
import { logEventFromRequest } from '../services/audit.service';
import { sendEmail } from '../services/email/email.service';
import { updateEmailConfig, getEmailConfig } from '../services/system-email-config.service';
import HttpError from '../utils/httpError';

const getSystemEmailConfig = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const config = await getEmailConfig();
    res.status(200).json({ config });
  } catch (error) {
    next(error);
  }
};

const updateSystemEmailConfig = async (
  req: Request<Record<string, never>, unknown, UpdateEmailConfigBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const config = await updateEmailConfig({
      provider: req.body.provider,
      fromEmail: req.body.fromEmail,
      fromName: req.body.fromName,
      enabled: req.body.enabled,
      smtpHost: req.body.smtpHost,
      smtpPort: req.body.smtpPort ?? undefined,
      smtpUser: req.body.smtpUser,
      smtpPassword: req.body.smtpPassword,
      smtpSecure: req.body.smtpSecure,
      resendApiKey: req.body.resendApiKey,
      sendgridApiKey: req.body.sendgridApiKey,
      sesAccessKey: req.body.sesAccessKey,
      sesSecretKey: req.body.sesSecretKey,
      sesRegion: req.body.sesRegion,
      mailgunApiKey: req.body.mailgunApiKey,
      mailgunDomain: req.body.mailgunDomain
    });

    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.ADMIN_EMAIL_CONFIG_UPDATE,
      entityType: 'SYSTEM_EMAIL_CONFIG',
      entityId: config.id,
      metadata: {
        provider: config.provider,
        enabled: config.enabled,
        changedFields: Object.keys(req.body).map((key) =>
          [
            'smtpPassword',
            'resendApiKey',
            'sendgridApiKey',
            'sesSecretKey',
            'mailgunApiKey'
          ].includes(key)
            ? `${key}Changed`
            : key
        )
      }
    });

    res.status(200).json({ config });
  } catch (error) {
    next(error);
  }
};

const testSystemEmailConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new HttpError(401, 'Token nao informado.');
    }

    const admin = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true, fullName: true }
    });

    if (!admin?.email) {
      throw new HttpError(400, 'Admin logado sem e-mail cadastrado para teste.');
    }

    await sendEmail({
      to: admin.email,
      subject: 'Teste de e-mail - auralinks',
      text: 'Este e-mail confirma que a configuracao de envio esta funcionando.',
      html: `<p>Ola ${admin.fullName || 'admin'}, este e-mail confirma que a configuracao de envio esta funcionando.</p>`
    });

    res.status(200).json({ ok: true, message: `E-mail de teste enviado para ${admin.email}.` });
  } catch (error) {
    next(error);
  }
};

export { getSystemEmailConfig, testSystemEmailConfig, updateSystemEmailConfig };
