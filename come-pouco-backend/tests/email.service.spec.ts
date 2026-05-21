import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const emailLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };

  return {
    emailLogger,
    getRawEmailConfig: vi.fn(),
    sendMail: vi.fn(),
    createTransport: vi.fn(),
    sesSend: vi.fn(),
    SESClient: vi.fn(),
    SendEmailCommand: vi.fn(),
    logger: {
      child: vi.fn(() => emailLogger)
    }
  };
});

vi.mock('../src/services/system-email-config.service', () => ({
  getRawEmailConfig: mocks.getRawEmailConfig
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mocks.createTransport
  }
}));

vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: mocks.SESClient,
  SendEmailCommand: mocks.SendEmailCommand
}));

vi.mock('../src/lib/logger', () => ({
  logger: mocks.logger
}));

import { sendEmail } from '../src/services/email/email.service';

const emailLogger = mocks.logger.child();

const baseConfig = {
  id: 1,
  provider: 'smtp',
  fromEmail: 'no-reply@test.local',
  fromName: ' Come Pouco ',
  enabled: true,
  smtpHost: 'smtp.test.local',
  smtpPort: 587,
  smtpUser: 'user',
  smtpPassword: 'pass',
  smtpSecure: false,
  resendApiKey: 'resend-key',
  sendgridApiKey: 'sendgrid-key',
  sesAccessKey: 'ses-access',
  sesSecretKey: 'ses-secret',
  sesRegion: 'us-east-1',
  mailgunApiKey: 'mailgun-key',
  mailgunDomain: 'mg.test.local',
  createdAt: new Date('2026-05-21T10:00:00.000Z'),
  updatedAt: new Date('2026-05-21T10:00:00.000Z')
};

const payload = {
  to: 'ana@test.local',
  subject: 'Teste',
  html: '<strong>Teste</strong>',
  text: 'Teste'
};

describe('sendEmail', () => {
  beforeEach(() => {
    mocks.getRawEmailConfig.mockResolvedValue(baseConfig);
    mocks.sendMail.mockResolvedValue({});
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
    mocks.sesSend.mockResolvedValue({});
    mocks.SESClient.mockImplementation(function MockSESClient(this: {
      send: typeof mocks.sesSend;
    }) {
      this.send = mocks.sesSend;
    });
    mocks.SendEmailCommand.mockImplementation(function MockSendEmailCommand(
      this: { input: unknown },
      input: unknown
    ) {
      this.input = input;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends SMTP email through nodemailer with a formatted from header', async () => {
    await sendEmail(payload);

    expect(mocks.createTransport).toHaveBeenCalledWith({
      host: 'smtp.test.local',
      port: 587,
      secure: false,
      auth: { user: 'user', pass: 'pass' }
    });
    expect(mocks.sendMail).toHaveBeenCalledWith({
      from: '"Come Pouco" <no-reply@test.local>',
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text
    });
  });

  it('sends Resend, SendGrid and Mailgun payloads with provider-specific APIs', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    mocks.getRawEmailConfig.mockResolvedValueOnce({ ...baseConfig, provider: 'resend' });
    await sendEmail(payload);

    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer resend-key' })
      })
    );

    mocks.getRawEmailConfig.mockResolvedValueOnce({ ...baseConfig, provider: 'sendgrid' });
    await sendEmail(payload);

    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.sendgrid.com/v3/mail/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sendgrid-key' })
      })
    );

    mocks.getRawEmailConfig.mockResolvedValueOnce({ ...baseConfig, provider: 'mailgun' });
    await sendEmail(payload);

    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.mailgun.net/v3/mg.test.local/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('api:mailgun-key').toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }),
        body: expect.stringContaining('to=ana%40test.local')
      })
    );
  });

  it('sends SES email with AWS SES client', async () => {
    mocks.getRawEmailConfig.mockResolvedValue({ ...baseConfig, provider: 'ses' });

    await sendEmail(payload);

    expect(mocks.SESClient).toHaveBeenCalledWith({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'ses-access',
        secretAccessKey: 'ses-secret'
      }
    });
    expect(mocks.SendEmailCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Source: '"Come Pouco" <no-reply@test.local>',
        Destination: { ToAddresses: [payload.to] }
      })
    );
    expect(mocks.sesSend).toHaveBeenCalled();
  });

  it('rejects disabled or incomplete email configuration', async () => {
    mocks.getRawEmailConfig.mockResolvedValueOnce({ ...baseConfig, enabled: false });

    await expect(sendEmail(payload)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Servico de e-mail desabilitado pelo administrador.'
    });
    expect(emailLogger.warn).toHaveBeenCalledWith(
      { eventType: 'email_send_blocked', reason: 'disabled' },
      'email send blocked'
    );

    mocks.getRawEmailConfig.mockResolvedValueOnce({ ...baseConfig, smtpPassword: null });

    await expect(sendEmail(payload)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Configuracao de e-mail incompleta: smtpPassword.'
    });
  });

  it('maps provider failures and unsupported providers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 500 }))
    );
    mocks.getRawEmailConfig.mockResolvedValueOnce({ ...baseConfig, provider: 'resend' });

    await expect(sendEmail(payload)).rejects.toMatchObject({
      statusCode: 502,
      message: 'Falha ao enviar e-mail pelo Resend.'
    });
    expect(emailLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'email_send_failed',
        provider: 'resend'
      }),
      'email send failed'
    );

    mocks.getRawEmailConfig.mockResolvedValueOnce({ ...baseConfig, provider: 'unknown' });

    await expect(sendEmail(payload)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Provider de e-mail nao suportado: unknown.'
    });
  });
});
