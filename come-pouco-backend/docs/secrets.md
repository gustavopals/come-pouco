# Segredos em repouso

## Escopo

Os segredos operacionais sao cifrados com AES-256-GCM e prefixo `enc:v1:`.

Campos cobertos:

- `purchase_platforms.secret`
- `purchase_platforms.access_key` (campo legado; o frontend atual ainda pode enviar o mesmo segredo aqui)
- `system_email_configs.smtp_password`
- `system_email_configs.resend_api_key`
- `system_email_configs.sendgrid_api_key`
- `system_email_configs.ses_secret_key`
- `system_email_configs.mailgun_api_key`

`ses_access_key`, `app_id`, URLs e dominios continuam em texto claro porque sao identificadores/configuracoes, nao secrets pelo escopo da Task 2.4.

## Chave

A cifra reutiliza `TWOFA_ENCRYPTION_KEY`, a mesma chave ja obrigatoria em producao para 2FA. A aplicacao falha no boot em producao se essa chave estiver no default de desenvolvimento.

## Migracao de dados existentes

Depois de aplicar o codigo, rode:

```bash
npm run secrets:migrate
```

O script e idempotente:

- valores vazios sao ignorados;
- valores ja iniciados com `enc:v1:` sao ignorados;
- valores plaintext sao cifrados no banco.

Para revisar sem gravar:

```bash
SECRETS_MIGRATION_DRY_RUN=true npm run secrets:migrate
```

## Rotacao de chave

Como `enc:v1:` nao guarda identificador de chave, a rotacao exige janela operacional controlada:

1. Parar writes administrativos de plataformas e configuracao de e-mail.
2. Fazer backup do banco.
3. Subir uma rotina temporaria que leia com a chave antiga e grave com a chave nova.
4. Trocar `TWOFA_ENCRYPTION_KEY` no ambiente.
5. Reiniciar a aplicacao.
6. Validar login 2FA, envio de e-mail e geracao de shortlink Shopee.

Nao troque `TWOFA_ENCRYPTION_KEY` diretamente sem recifrar os valores existentes; isso quebra a leitura de TOTP, credenciais Shopee e secrets de e-mail.
