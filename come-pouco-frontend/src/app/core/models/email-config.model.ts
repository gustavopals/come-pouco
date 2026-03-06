export type EmailProvider = 'smtp' | 'resend' | 'sendgrid' | 'ses' | 'mailgun';

export interface SystemEmailConfig {
  id: number;
  provider: EmailProvider;
  fromEmail: string;
  fromName: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpSecure: boolean | null;
  resendApiKey: string | null;
  sendgridApiKey: string | null;
  sesAccessKey: string | null;
  sesSecretKey: string | null;
  sesRegion: string | null;
  mailgunApiKey: string | null;
  mailgunDomain: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSystemEmailConfigPayload {
  provider: EmailProvider;
  fromEmail: string;
  fromName?: string | null;
  enabled?: boolean;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  smtpSecure?: boolean | null;
  resendApiKey?: string | null;
  sendgridApiKey?: string | null;
  sesAccessKey?: string | null;
  sesSecretKey?: string | null;
  sesRegion?: string | null;
  mailgunApiKey?: string | null;
  mailgunDomain?: string | null;
}
