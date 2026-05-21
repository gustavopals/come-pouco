export type LucideIconName =
  | 'Zap'
  | 'Users'
  | 'BarChart3'
  | 'TestTube'
  | 'ShieldCheck'
  | 'Webhook'
  | 'KeyRound'
  | 'Lock'
  | 'FileSearch'
  | 'HardDriveDownload'
  | 'Globe'
  | 'Link'
  | 'User';

export interface Feature {
  icon: LucideIconName;
  title: string;
  description: string;
  /** Marca o card com badge "Em breve" */
  upcoming?: boolean;
  variant?: 'primary' | 'accent' | 'info' | 'success';
}

export const coreFeatures: Feature[] = [
  {
    icon: 'Zap',
    variant: 'primary',
    title: 'Geração de links em massa',
    description:
      'Cole várias URLs Shopee de uma vez e receba todos os links de afiliado convertidos e rastreáveis.'
  },
  {
    icon: 'Users',
    variant: 'accent',
    title: 'Multi-tenant + multi-time',
    description:
      'Empresas com donos e funcionários, cada um com acesso e métricas próprios — sem misturar dados.'
  },
  {
    icon: 'BarChart3',
    variant: 'info',
    title: 'Dashboard com métricas',
    description: 'Produção diária, médias, top produtos. Saiba o que vende — não chute.'
  },
  {
    icon: 'TestTube',
    variant: 'success',
    title: 'Modo TEST e PROD',
    description:
      'Homologue integrações sem queimar quota real da Shopee. Liga o PROD quando estiver pronto.'
  },
  {
    icon: 'ShieldCheck',
    variant: 'primary',
    title: '2FA + audit log',
    description:
      'TOTP, dispositivos confiáveis e registro de toda ação sensível. Segurança bancária pro seu negócio.'
  },
  {
    icon: 'Webhook',
    variant: 'accent',
    title: 'API + webhooks',
    description: 'Plugue seu CRM ou sua loja com integrações REST e eventos em tempo real.',
    upcoming: true
  }
];

export interface SecurityBadge {
  icon: LucideIconName;
  title: string;
  description: string;
}

export const securityBadges: SecurityBadge[] = [
  {
    icon: 'KeyRound',
    title: '2FA TOTP',
    description: 'Login em dois fatores com app autenticador + códigos de backup.'
  },
  {
    icon: 'Lock',
    title: 'Criptografia AES-256',
    description: 'Segredos sensíveis criptografados em repouso com chave rotacionável.'
  },
  {
    icon: 'FileSearch',
    title: 'Audit log completo',
    description: 'Toda ação sensível registrada e consultável por administradores.'
  },
  {
    icon: 'ShieldCheck',
    title: 'Conformidade LGPD',
    description: 'Dados pessoais minimizados, retenção configurável e exportação sob pedido.'
  },
  {
    icon: 'HardDriveDownload',
    title: 'Backups diários',
    description: 'Snapshots automáticos do banco com retenção mínima de 7 dias.'
  },
  {
    icon: 'Globe',
    title: 'SSL/TLS em tudo',
    description: 'HTTPS obrigatório, HSTS e cabeçalhos de segurança por padrão.'
  }
];

export interface HowItWorksStep {
  number: string;
  title: string;
  description: string;
}

export const howItWorksSteps: HowItWorksStep[] = [
  {
    number: '01',
    title: 'Crie sua conta gratuita',
    description: 'Cadastro em menos de 1 minuto. Sem cartão. Sem compromisso.'
  },
  {
    number: '02',
    title: 'Conecte sua Shopee Afiliados',
    description: 'Cole suas credenciais TEST e PROD. Validamos e você está pronto.'
  },
  {
    number: '03',
    title: 'Adicione seu time',
    description: 'Convide funcionários, defina permissões e veja a produção de cada um.'
  },
  {
    number: '04',
    title: 'Compartilhe e venda',
    description:
      'Use sua URL pública Alli ou gere links direto no painel. A audiência converte sozinha.'
  }
];

export interface AlliBenefit {
  icon: LucideIconName;
  text: string;
}

export const alliBenefits: AlliBenefit[] = [
  { icon: 'Link', text: 'Funciona com shope.ee e com link longo da Shopee' },
  { icon: 'User', text: 'Atribuição por funcionário (/p/loja/joao)' },
  { icon: 'ShieldCheck', text: 'Fallback automático se a Shopee falhar' }
];
