# Sentry

A Fase 6 usa Sentry Cloud para error tracking do backend, frontend Angular e landing Astro.

## Variaveis

Backend:

- `SENTRY_DSN_BACKEND`
- `SENTRY_TRACES_SAMPLE_RATE_BACKEND`
- `SENTRY_PROJECT_BACKEND`

Frontend Angular:

- `SENTRY_DSN_FRONTEND`
- `SENTRY_TRACES_SAMPLE_RATE_FRONTEND`
- `SENTRY_PROJECT_FRONTEND`

Landing Astro:

- `SENTRY_DSN_LANDING`
- `SENTRY_TRACES_SAMPLE_RATE_LANDING`
- `SENTRY_PROJECT_LANDING`

Compartilhadas:

- `SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE`
- `SENTRY_ORG`
- `SENTRY_AUTH_TOKEN`

`SENTRY_RELEASE` deve receber o SHA do commit no pipeline. Se ausente, os scripts tentam `COMMIT_SHA` e `GIT_SHA`.

## Runtime

O backend inicializa Sentry antes do Express em `src/lib/sentry.ts`. O error handler global captura apenas falhas 5xx e adiciona tags:

- `requestId`
- `userId`
- `companyId`
- `eventType`
- `statusCode`
- `errorCode`

O Angular inicializa Sentry antes do `bootstrapApplication`, instala o `ErrorHandler` do SDK e mantém contexto de usuário com apenas `id`, `role`, `companyId` e `companyRole`.

A landing usa `@sentry/astro` com `sentry.client.config.ts`.

## PII

Os três runtimes usam `sendDefaultPii: false` e `beforeSend` para redigir campos sensiveis, incluindo senhas, tokens, cookies, headers de autorizacao, secrets, API keys e e-mails.

Nao envie payloads completos para Sentry. Quando precisar de correlacao, use ids internos, `requestId` e hashes curtos.

## Source maps

Backend e frontend executam upload de sourcemaps no `postbuild`, mas o script vira no-op quando faltam credenciais. Para upload real, configure:

```bash
SENTRY_AUTH_TOKEN=...
SENTRY_ORG=...
SENTRY_RELEASE=$(git rev-parse HEAD)
SENTRY_PROJECT_BACKEND=...
SENTRY_PROJECT_FRONTEND=...
```

A landing usa o upload integrado do `@sentry/astro` quando `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` e `SENTRY_PROJECT_LANDING` estao presentes.

Em builds locais sem essas variaveis, os uploads sao ignorados para nao quebrar o ciclo de desenvolvimento.
