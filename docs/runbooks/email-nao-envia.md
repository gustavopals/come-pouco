# Runbook: Email nao envia

## Sintomas

- `/api/health/ready` retorna `email.status=degraded`.
- Fluxos de `forgot-password`, teste de e-mail admin ou notificacoes de lead nao chegam.
- Admin ve falha ao acionar `POST /api/admin/email-config/test`.
- Logs mostram erro do provider SMTP, Resend, SES, SendGrid ou Mailgun.

## Confirmacao

Verifique readiness:

```bash
curl http://localhost:3000/api/health/ready | jq '.checks.email'
```

Confira configuracao ativa no admin:

```text
Frontend: /admin/email-settings
API: GET /api/admin/email-config
```

No banco, valide provider e campos obrigatorios sem expor secrets:

```sql
SELECT provider, from_email, from_name, enabled, smtp_host, smtp_port, ses_region, mailgun_domain, updated_at
FROM system_email_configs
WHERE id = 1;
```

## Mitigacao imediata

1. Se `enabled=false`, reative o transporte no admin.
2. Corrija campos obrigatorios do provider atual: remetente, host/porta SMTP, dominio Mailgun, region SES ou API key.
3. Use o botao "Testar envio" em `/admin/email-settings` apos salvar.
4. Se o provider atual estiver fora, troque temporariamente para outro provider ja validado.
5. Para reset de senha urgente, gere novo token apenas por fluxo administrativo seguro e registre o incidente.

## Root cause analysis

- Confirmar se houve rotacao de chave, expiracao de credencial, bloqueio de dominio/remetente ou mudanca DNS.
- Revisar logs do provider externo e status de quota/rate limit.
- Validar se a criptografia at-rest manteve secrets legiveis pelo runtime.
- Registrar provider, erro bruto sanitizado, horario da falha e acao corretiva.

## Comunicacao

Mensagem interna:

```text
Falha de envio de e-mail em investigacao. Impacto: reset de senha e notificacoes transacionais podem atrasar. Acao: validando provider ativo e teste de envio. Proxima atualizacao em 15 minutos.
```

Mensagem de resolucao:

```text
Envio de e-mail normalizado. Periodo afetado: <inicio> a <fim>. Acao aplicada: <credencial/provider/DNS/config>. Fluxos transacionais foram retestados com sucesso.
```
