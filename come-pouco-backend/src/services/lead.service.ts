import prisma from '../config/prisma';
import { logger } from '../lib/logger';
import { sendEmail } from './email/email.service';
import type { LeadCreateInput } from '../schemas/leads.schema';

interface CreateLeadInput extends LeadCreateInput {
  ipAddress?: string;
  userAgent?: string;
}

const NOTIFY_TO = process.env.LEAD_NOTIFY_EMAIL?.trim() || 'contato@come-pouco.com.br';
const leadLogger = logger.child({ scope: 'lead' });

const renderHtml = (lead: CreateLeadInput): string => `
<!doctype html>
<html lang="pt-BR">
  <body style="font-family: Manrope, Segoe UI, sans-serif; line-height: 1.5; color: #101418; background: #f7f8fa; padding: 24px;">
    <h2 style="margin: 0 0 8px 0;">Novo lead da landing</h2>
    <p style="margin: 0 0 24px 0; color: #5f6b7a;">Recebido em ${new Date().toLocaleString('pt-BR')}</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px; border-bottom: 1px solid #dde3ea;"><strong>Nome</strong></td><td style="padding: 8px; border-bottom: 1px solid #dde3ea;">${escape(lead.name)}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #dde3ea;"><strong>Email</strong></td><td style="padding: 8px; border-bottom: 1px solid #dde3ea;">${escape(lead.email)}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #dde3ea;"><strong>Volume</strong></td><td style="padding: 8px; border-bottom: 1px solid #dde3ea;">${escape(lead.volume ?? '—')}</td></tr>
      <tr><td style="padding: 8px; vertical-align: top;"><strong>Mensagem</strong></td><td style="padding: 8px; white-space: pre-wrap;">${escape(lead.message ?? '—')}</td></tr>
    </table>
  </body>
</html>
`;

const escape = (input: string): string =>
  input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const createLead = async (input: CreateLeadInput): Promise<{ id: number }> => {
  const created = await prisma.lead.create({
    data: {
      name: input.name,
      email: input.email,
      volume: input.volume ?? null,
      message: input.message ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null
    },
    select: { id: true }
  });

  // Envio de e-mail fire-and-forget — não bloqueia a resposta nem derruba a criação se falhar.
  void (async () => {
    try {
      await sendEmail({
        to: NOTIFY_TO,
        subject: `[Come Pouco] Novo lead: ${input.name}`,
        html: renderHtml(input),
        text: `Novo lead\nNome: ${input.name}\nEmail: ${input.email}\nVolume: ${input.volume ?? '—'}\nMensagem: ${input.message ?? '—'}`
      });
      await prisma.lead.update({ where: { id: created.id }, data: { notified: true } });
    } catch (error) {
      leadLogger.warn(
        {
          eventType: 'lead_notification_failed',
          leadId: created.id,
          err: error instanceof Error ? error : undefined,
          error: error instanceof Error ? undefined : error
        },
        'lead notification failed'
      );
    }
  })();

  return created;
};

export { createLead };
