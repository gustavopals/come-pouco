# Playwright E2E

Suite E2E da Fase 5.5. Os specs usam browser real, backend real, banco PostgreSQL real e Mailpit.

## Comandos

```bash
npm run e2e:install  # instalar browsers do Playwright uma vez
npm run e2e:list     # listar specs sem subir servidores
npm run e2e          # headless
npm run e2e:headed   # debug visual
```

`npm run e2e` sobe `postgres` e `mailpit` via Docker Compose. O Playwright sobe backend em `3001`, frontend em `4200` e landing em `4321`.

O backend E2E roda com `SHOPEE_MOCK=true`, `SHORTLINK_MOCK_TARGET_URL=https://shopee.com.br/product/10001/20002` e `SHOPEE_MOCK_FAILURE_PATTERN=e2e-force-fallback`. Assim os testes do modulo publico cobrem shortlinks e fallback sem chamar a API real da Shopee.

## Overrides úteis

- `E2E_SKIP_WEBSERVER=true` para usar servidores já rodando.
- `E2E_BACKEND_URL`, `E2E_FRONTEND_URL`, `E2E_LANDING_URL`, `E2E_MAILPIT_URL`.
- `DATABASE_URL` para apontar para outro Postgres isolado.

O spec de billing está marcado como `skip` até a Fase 7 entregar Stripe/billing.

`e2e/specs/public-alli.spec.ts` cobre URL longa, shortlink, URL invalida, honeypot, fallback, slug inexistente e employee slug invalido.
