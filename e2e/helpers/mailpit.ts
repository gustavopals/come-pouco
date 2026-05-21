import { expect } from '@playwright/test';

import { e2eConfig } from './config';
import { encryptSecret } from './crypto';
import { getPrisma } from './db';

type MailpitListResponse = {
  messages?: unknown[];
  Messages?: unknown[];
};

const resetLinkRegex = /https?:\/\/[^"'\s<>]+\/reset-password\?token=[^"'\s<>]+/i;

const configureMailpitEmail = async (): Promise<void> => {
  const prisma = getPrisma();

  await prisma.systemEmailConfig.upsert({
    where: { id: 1 },
    update: {
      provider: 'smtp',
      fromEmail: 'no-reply@comepouco.local',
      fromName: 'Come Pouco E2E',
      enabled: true,
      smtpHost: '127.0.0.1',
      smtpPort: 1025,
      smtpUser: 'mailpit',
      smtpPassword: encryptSecret('mailpit'),
      smtpSecure: false
    },
    create: {
      id: 1,
      provider: 'smtp',
      fromEmail: 'no-reply@comepouco.local',
      fromName: 'Come Pouco E2E',
      enabled: true,
      smtpHost: '127.0.0.1',
      smtpPort: 1025,
      smtpUser: 'mailpit',
      smtpPassword: encryptSecret('mailpit'),
      smtpSecure: false
    }
  });
};

const clearMailpitInbox = async (): Promise<void> => {
  await fetch(`${e2eConfig.mailpitURL}/api/v1/messages`, { method: 'DELETE' });
};

const waitForPasswordResetLink = async (email: string): Promise<string> => {
  let foundLink: string | null = null;

  await expect
    .poll(
      async () => {
        foundLink = await findPasswordResetLink(email);
        return foundLink;
      },
      {
        timeout: 20_000,
        intervals: [500, 1_000, 2_000]
      }
    )
    .not.toBeNull();

  return foundLink!;
};

const findPasswordResetLink = async (email: string): Promise<string | null> => {
  const listResponse = await fetch(`${e2eConfig.mailpitURL}/api/v1/messages?limit=50`);
  if (!listResponse.ok) {
    throw new Error(`Mailpit indisponivel em ${e2eConfig.mailpitURL}`);
  }

  const list = (await listResponse.json()) as MailpitListResponse;
  const messages = list.messages || list.Messages || [];

  for (const message of messages) {
    const id = getMessageId(message);
    if (!id) {
      continue;
    }

    const detailResponse = await fetch(
      `${e2eConfig.mailpitURL}/api/v1/message/${encodeURIComponent(id)}`
    );
    if (!detailResponse.ok) {
      continue;
    }

    const detail = await detailResponse.json();
    const serialized = JSON.stringify(detail);

    if (!serialized.toLowerCase().includes(email.toLowerCase())) {
      continue;
    }

    const link = serialized.match(resetLinkRegex)?.[0];
    if (link) {
      return link.replace(/\\u0026/g, '&');
    }
  }

  return null;
};

const getMessageId = (message: unknown): string | null => {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const record = message as Record<string, unknown>;
  const id = record['ID'] || record['Id'] || record['id'];

  return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
};

export { clearMailpitInbox, configureMailpitEmail, waitForPasswordResetLink };
