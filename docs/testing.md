# Testing

Este projeto usa Vitest no backend, frontend e landing, com Playwright para fluxos E2E. A regra prática é: teste comportamento observável, não detalhes internos.

## Comandos

| Escopo               | Comando                                                                                                  | Observação                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Backend unit         | `npm run test:backend`                                                                                   | Exclui `tests/integration/**/*.spec.ts`.                     |
| Backend coverage     | `npm run test:backend:cov`                                                                               | Gera `come-pouco-backend/coverage/`.                         |
| Frontend unit        | `npm run test:frontend`                                                                                  | Usa Angular `@angular/build:unit-test` + Vitest.             |
| Frontend coverage    | `npm run test:frontend:cov`                                                                              | Gera `come-pouco-frontend/coverage/come-pouco-frontend/`.    |
| Landing unit         | `npm run test:landing`                                                                                   | Testa `come-pouco-landing/src/lib`.                          |
| Landing coverage     | `npm run test:landing:cov`                                                                               | Gera `come-pouco-landing/coverage/`.                         |
| E2E list             | `npm run e2e:list`                                                                                       | Valida descoberta dos specs sem subir servidores.            |
| E2E completo         | `npm run e2e`                                                                                            | Requer Docker, Postgres e Mailpit.                           |
| Tudo que bloqueia PR | `npm run lint && npm run check && npm run test:backend && npm run test:frontend && npm run test:landing` | Rode antes de abrir PR quando mexer em áreas compartilhadas. |

## Estrutura

- `come-pouco-backend/src/**/*.spec.ts`: testes co-localizados simples.
- `come-pouco-backend/tests/**/*.spec.ts`: testes unitários compartilhados e integração backend.
- `come-pouco-backend/tests/integration/`: testes com app Express + banco real isolado.
- `come-pouco-backend/tests/helpers/`: helpers para Prisma mockado, schema isolado e `supertest`.
- `come-pouco-backend/tests/factories/`: builders para `Company`, `User`, `PurchasePlatform`, `AffiliateLink` e `LandingConfig`.
- `come-pouco-frontend/src/**/*.spec.ts`: testes Angular de services, guards, interceptors e componentes.
- `come-pouco-landing/src/lib/**/*.spec.ts`: testes de conteúdo e helpers da landing.
- `e2e/specs/`: Playwright em browser real.
- `e2e/helpers/`: login programático, DB, Mailpit e configuração.

## Backend

Use `vitest-mock-extended` para testes unitários que não devem tocar o banco:

```ts
import { prismaMock } from '../tests/helpers/prisma-mock';
```

Para integração com banco real, use `tests/helpers/integration-test-app.ts`. Ele cria um schema PostgreSQL `test_<uuid>`, roda `prisma migrate deploy`, importa o app Express e limpa tudo no fim da suite.

Integração é opt-in:

```bash
RUN_INTEGRATION_TESTS=true npm --prefix come-pouco-backend run test:integration
```

Use `TEST_DATABASE_URL` se quiser apontar para um banco diferente do `DATABASE_URL`.

## Frontend

O frontend roda pelo builder `@angular/build:unit-test`. Prefira:

- `TestBed` para services, guards e interceptors.
- Mocks de `HttpClient`/services em vez de chamadas reais.
- Assertions sobre estado visível, navegação, requests e sinais públicos.
- Specs de componentes nos fluxos complexos: login/2FA, paginação, CRUD e validação.

Evite inspecionar propriedades privadas ou depender de ordem interna de chamadas quando o comportamento público já cobre o caso.

## Landing

A landing é majoritariamente estática. Os testes cobrem os módulos de conteúdo e analytics em `src/lib`, porque eles alimentam a renderização Astro. Componentes `.astro` seguem cobertos por `astro check`, build e E2E.

## E2E

Playwright cobre os fluxos críticos:

- login + 2FA;
- geração de affiliate links em modo MOCK;
- módulo Alli público;
- reset de senha via Mailpit;
- billing checkout fica `test.skip` até a Fase 7.

Para rodar:

```bash
npm run e2e
```

O comando sobe `postgres` e `mailpit` via Docker e o Playwright inicia backend, frontend e landing via `webServer`. Para usar servidores já rodando:

```bash
E2E_SKIP_WEBSERVER=true npm run e2e:test
```

## Coverage

O CI publica artifacts `coverage-backend`, `coverage-frontend` e `coverage-landing`. O job `coverage-comment` comenta no PR:

- cobertura por pacote;
- cobertura dos arquivos alterados;
- arquivos alterados que não aparecem no relatório de coverage.

Badges locais do README são gerados com:

```bash
npm run coverage:badges
```

Alvos atuais são sinalizadores, não gates:

- backend critical services: 60% lines;
- frontend core services/guards: 45% lines;
- landing libs: 45% lines.

## Convenções

- Nomeie specs como `*.spec.ts`.
- Teste input/output, HTTP status, dados persistidos, redirects e estado de UI.
- Use factories para dados repetidos.
- Mantenha fixtures pequenas e explícitas.
- Um teste deve falhar por uma única razão clara.
- Não faça teste depender de rede externa; Shopee fica em MOCK nos testes.
- Não use snapshots grandes para HTML inteiro.
- Não teste implementação quando uma assertion de comportamento é suficiente.
