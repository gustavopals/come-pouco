# Logging

O backend usa `pino` para logs estruturados em JSON e `pino-http` para logs por request.

## Configuracao

- `LOG_LEVEL`: `trace`, `debug`, `info`, `warn`, `error`, `fatal` ou `silent`.
- `LOG_FORMAT`: `json` ou `pretty`.

Defaults:

- Desenvolvimento: `LOG_LEVEL=debug`, `LOG_FORMAT=pretty`.
- Producao: `LOG_LEVEL=info`, `LOG_FORMAT=json`.

Mesmo com `LOG_FORMAT=pretty`, producao sempre deve operar com JSON puro para ingestao por ferramentas de observabilidade.

## Campos padrao

Logs do backend devem ser emitidos como objetos estruturados:

- `eventType`: nome estavel do evento.
- `scope`: modulo ou area funcional, normalmente definido por `logger.child({ scope })`.
- `requestId`: quando houver request HTTP.
- `userId` e `companyId`: quando o contexto autenticado estiver disponivel.
- `err`: objeto `Error` quando houver excecao.

Exemplo:

```ts
logger.warn(
  {
    eventType: 'email_send_failed',
    provider,
    err: error
  },
  'email send failed'
);
```

## Request logger

`pino-http` roda depois do middleware de `X-Request-Id`, entao `req.log` fica disponivel para controllers e middlewares com o mesmo `requestId` da resposta.

O log automatico de HTTP inclui:

- metodo, URL e status;
- `responseTimeMs`;
- `requestId`;
- `route`, quando o Express consegue resolver o template;
- `userId` e `companyId`, quando preenchidos pelo middleware de auth.

## Dados sensiveis

O logger aplica redaction para campos comuns de segredo, incluindo:

- senhas e hashes;
- tokens e cookies;
- secrets/API keys de provedores;
- segredos 2FA;
- credenciais SMTP, SES, SendGrid, Resend e Mailgun.

Evite logar payloads completos. Prefira ids, hashes curtos e metadados minimos. Em fluxos de recuperacao de senha, use hash curto de e-mail em vez do e-mail bruto.
