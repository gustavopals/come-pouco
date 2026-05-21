export interface FaqItem {
  q: string;
  a: string;
}

export const faq: FaqItem[] = [
  {
    q: 'Preciso ter conta na Shopee Afiliados?',
    a: 'Sim. A auralinks se conecta à sua conta oficial da Shopee Afiliados via API. Suportamos credenciais separadas de TEST (sandbox) e PROD para você homologar sem queimar quota real.'
  },
  {
    q: 'Como funciona o módulo Alli?',
    a: 'Cada empresa recebe uma URL pública no formato auralinks.com.br/p/sua-loja. Seus seguidores colam qualquer link Shopee na página e são redirecionados de volta pra Shopee já com o seu link de afiliado aplicado — você ganha a comissão sem precisar gerar nada manualmente.'
  },
  {
    q: 'Quantos links posso gerar?',
    a: 'No plano Free: até 100 links por mês. No Pro e Enterprise: ilimitado. Cada geração é registrada e contabilizada no dashboard.'
  },
  {
    q: 'Posso adicionar funcionários?',
    a: 'Sim. No plano Free são até 1 usuário, no Pro até 5, e no Enterprise ilimitado. Cada funcionário tem credenciais próprias, vê só os links que gerou e a empresa vê tudo agregado.'
  },
  {
    q: 'Meus dados estão seguros?',
    a: 'Sim. Aplicamos AES-256 em segredos sensíveis, TLS em tudo, audit log de ações administrativas, 2FA TOTP, dispositivos confiáveis e backups diários. Conformidade LGPD por padrão.'
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim. Sem fidelidade, sem multa. Cancela direto pelo painel e seus dados ficam disponíveis pra exportação por 30 dias.'
  },
  {
    q: 'Quanto tempo dura o Free?',
    a: 'O plano Free é gratuito por 1 mês para validar a operação. Depois, você pode migrar para o Pro quando precisar de mais usuários ou recursos.'
  },
  {
    q: 'Como integro com Instagram e TikTok?',
    a: 'Sua URL pública Alli pode entrar direto na bio do Instagram, link na bio do TikTok ou compartilhada nos Stories. Não precisa de integração técnica — é só compartilhar a URL.'
  },
  {
    q: 'Posso ter mais de uma empresa?',
    a: 'No plano Free: 1 empresa. Pro: até 3. Enterprise: ilimitado. Cada empresa tem seus próprios dados, credenciais Shopee, funcionários e dashboard, completamente isolados.'
  },
  {
    q: 'Vocês têm API?',
    a: 'Sim, no plano Pro temos endpoints REST documentados para integração com seu CRM ou loja. Webhooks de eventos estão na nossa próxima entrega — Enterprise tem API customizada disponível hoje.'
  }
];
