import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';

import { getRawEmailConfig } from '../system-email-config.service';
import HttpError from '../../utils/httpError';

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

const buildFromHeader = (fromEmail: string, fromName: string | null): string => {
  if (!fromName || !fromName.trim().length) {
    return fromEmail;
  }

  return `"${fromName.trim()}" <${fromEmail}>`;
};

const requireValue = (value: string | null, fieldName: string): string => {
  if (!value || !value.trim().length) {
    throw new HttpError(400, `Configuracao de e-mail incompleta: ${fieldName}.`);
  }

  return value.trim();
};

const sendWithSmtp = async (config: Awaited<ReturnType<typeof getRawEmailConfig>>, payload: SendEmailInput): Promise<void> => {
  const host = requireValue(config.smtpHost, 'smtpHost');
  const port = config.smtpPort;
  const user = requireValue(config.smtpUser, 'smtpUser');
  const pass = requireValue(config.smtpPassword, 'smtpPassword');

  if (!port || !Number.isInteger(port) || port <= 0) {
    throw new HttpError(400, 'Configuracao de e-mail incompleta: smtpPort.');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: Boolean(config.smtpSecure),
    auth: { user, pass }
  });

  await transporter.sendMail({
    from: buildFromHeader(config.fromEmail, config.fromName),
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text
  });
};

const sendWithResend = async (config: Awaited<ReturnType<typeof getRawEmailConfig>>, payload: SendEmailInput): Promise<void> => {
  const apiKey = requireValue(config.resendApiKey, 'resendApiKey');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: buildFromHeader(config.fromEmail, config.fromName),
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text
    })
  });

  if (!response.ok) {
    throw new HttpError(502, 'Falha ao enviar e-mail pelo Resend.');
  }
};

const sendWithSendgrid = async (config: Awaited<ReturnType<typeof getRawEmailConfig>>, payload: SendEmailInput): Promise<void> => {
  const apiKey = requireValue(config.sendgridApiKey, 'sendgridApiKey');
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: payload.to }] }],
      from: { email: config.fromEmail, name: config.fromName || undefined },
      subject: payload.subject,
      content: [
        { type: 'text/plain', value: payload.text || '' },
        { type: 'text/html', value: payload.html }
      ]
    })
  });

  if (!response.ok) {
    throw new HttpError(502, 'Falha ao enviar e-mail pelo SendGrid.');
  }
};

const sendWithSes = async (config: Awaited<ReturnType<typeof getRawEmailConfig>>, payload: SendEmailInput): Promise<void> => {
  const accessKeyId = requireValue(config.sesAccessKey, 'sesAccessKey');
  const secretAccessKey = requireValue(config.sesSecretKey, 'sesSecretKey');
  const region = requireValue(config.sesRegion, 'sesRegion');

  const client = new SESClient({
    region,
    credentials: { accessKeyId, secretAccessKey }
  });

  await client.send(
    new SendEmailCommand({
      Source: buildFromHeader(config.fromEmail, config.fromName),
      Destination: { ToAddresses: [payload.to] },
      Message: {
        Subject: { Data: payload.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: payload.html, Charset: 'UTF-8' },
          Text: { Data: payload.text || '', Charset: 'UTF-8' }
        }
      }
    })
  );
};

const sendWithMailgun = async (config: Awaited<ReturnType<typeof getRawEmailConfig>>, payload: SendEmailInput): Promise<void> => {
  const apiKey = requireValue(config.mailgunApiKey, 'mailgunApiKey');
  const domain = requireValue(config.mailgunDomain, 'mailgunDomain');
  const params = new URLSearchParams();
  params.append('from', buildFromHeader(config.fromEmail, config.fromName));
  params.append('to', payload.to);
  params.append('subject', payload.subject);
  params.append('html', payload.html);
  params.append('text', payload.text || '');

  const token = Buffer.from(`api:${apiKey}`).toString('base64');
  const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    throw new HttpError(502, 'Falha ao enviar e-mail pelo Mailgun.');
  }
};

const sendEmail = async (payload: SendEmailInput): Promise<void> => {
  const config = await getRawEmailConfig();
  const provider = config.provider.toLowerCase();

  if (!config.enabled) {
    console.warn('[email] envio bloqueado: servico de e-mail desabilitado.');
    throw new HttpError(400, 'Servico de e-mail desabilitado pelo administrador.');
  }

  console.info(`[email] provider selecionado: ${provider}`);

  try {
    if (provider === 'smtp') {
      await sendWithSmtp(config, payload);
      return;
    }

    if (provider === 'resend') {
      await sendWithResend(config, payload);
      return;
    }

    if (provider === 'sendgrid') {
      await sendWithSendgrid(config, payload);
      return;
    }

    if (provider === 'ses') {
      await sendWithSes(config, payload);
      return;
    }

    if (provider === 'mailgun') {
      await sendWithMailgun(config, payload);
      return;
    }

    throw new HttpError(400, `Provider de e-mail nao suportado: ${provider}.`);
  } catch (error) {
    console.error(`[email] falha no envio com provider=${provider}:`, error instanceof Error ? error.message : 'erro desconhecido');
    throw error;
  }
};

export { sendEmail };
export type { SendEmailInput };
