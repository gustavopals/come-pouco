# Come Pouco Monorepo

Estrutura com frontend Angular, backend Node.js + Express + TypeScript, Prisma ORM e PostgreSQL em Docker.

## Estrutura

- `come-pouco-frontend`: app Angular.
- `come-pouco-backend`: API Express + Prisma.
- `database/init/*.sql`: inicializacao do banco para ambiente Docker.
- `docker-compose.yml`: ambiente local do PostgreSQL.

## Pre-requisitos

- Node.js 22+
- npm 10+
- Docker + Docker Compose

## Banco de dados

```bash
docker compose up -d
```

Para resetar em DEV quando houver mudancas de schema:

```bash
docker compose down -v && docker compose up -d
```

## Backend

```bash
cd come-pouco-backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

API em `http://localhost:3000`.

## Frontend

```bash
cd come-pouco-frontend
npm install
npm start
```

App em `http://localhost:4200`.

## Credenciais de teste

- E-mail: `admin@comepouco.local`
- Senha: `123456`

## Recursos implementados

- Auth JWT com `ADMIN` (global) e `USER`.
- Multi-empresa:
  - `Company`
  - `companyId` e `companyRole` (`OWNER`/`EMPLOYEE`) no usuario.
  - Escopo de visualizacao/autorizacao em `affiliate-links` no backend.
- Shopee integration:
  - `POST /api/integrations/shopee/generate-shortlinks`
  - suporte a `SHOPEE_MOCK=true` para testes sem credenciais reais.
  - resolucao de plataforma por Empresa via `Company.shopeePlatformId`.
  - suporte a `mockMode` por plataforma (se ligado, gera shortlinks simulados).

## Principais endpoints

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET/POST/PUT/DELETE /api/users`
- `POST /api/users/employees` (OWNER cria funcionario da propria empresa)
- `GET/POST/PUT /api/companies` (ADMIN)
- `GET/POST/PUT/DELETE /api/affiliate-links`
- `GET/POST/PUT/DELETE /api/purchase-platforms`
- `POST /api/integrations/shopee/generate-shortlinks`

## Exemplo cURL Shopee

```bash
curl -X POST "http://localhost:3000/api/integrations/shopee/generate-shortlinks" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "originUrls": [
      "https://example.com/produto-1",
      "https://example.com/produto-2"
    ],
    "subId1": "maria"
  }'
```

Observacao: `platformId` continua opcional para ADMIN (override manual). Para OWNER/EMPLOYEE, a API usa automaticamente a configuracao da Empresa.

## Teste manual (sem credenciais reais)

1. No backend, configure no `.env`: `SHOPEE_MOCK=true`.
2. Suba o banco: `docker compose up -d`.
3. Rode backend e frontend.
4. Como ADMIN:
   - cadastre uma plataforma SHOPEE ativa em `Plataforma de Compras`.
   - ligue `Modo Sandbox (Mock)` para testes sem credenciais reais.
   - crie a empresa `Empresa A` em `Empresas`.
   - vincule a `Plataforma Shopee` na empresa.
   - crie um usuario OWNER da `Empresa A` em `Usuarios`.
5. Faca login como OWNER:
   - abra `Minha Empresa`.
   - crie 2 funcionarios (EMPLOYEE).
6. Faca login como EMPLOYEE1:
   - gere links (ate 10) em `Affiliate Links`.
7. Faca login como EMPLOYEE2:
   - gere links tambem.
8. Faca login como OWNER:
   - verifique que enxerga os links dos dois funcionarios e coluna `Criado por`.
9. Faca login como EMPLOYEE1:
   - verifique que nao enxerga os links do EMPLOYEE2.
10. Volte como ADMIN e desligue `Modo Sandbox (Mock)` na plataforma:
   - com credenciais reais validas, o fluxo passa a usar chamada real da Shopee.
11. Faca login como ADMIN:
   - verifique que enxerga todos os links.
