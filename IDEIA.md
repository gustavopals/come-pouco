# Come Pouco — Visão Geral do Projeto

> Plataforma SaaS multi-empresa para geração e gestão de links de afiliado, com integração nativa à API de afiliados da Shopee Brasil.

---

## 1. O que é o projeto

O **Come Pouco** é uma aplicação web que centraliza a operação de programas de afiliados de múltiplas empresas em um único painel. Ele permite que cada empresa cadastre suas credenciais Shopee, distribua acesso entre seus colaboradores (funcionários afiliados) e gere em lote links curtos rastreáveis (shortlinks) a partir das URLs originais de produtos — tudo respeitando isolamento por empresa, controle de papéis e auditoria de uso da API.

O nome "Come Pouco" reflete o público-alvo original: o **administrador global** (`ADMIN`) gerencia a infraestrutura compartilhada (plataformas, empresas, configurações de e-mail), enquanto cada **empresa cliente** opera sua própria base de afiliados como um tenant isolado.

---

## 2. Para que serve

### Problema que resolve

Quem trabalha com marketing de afiliados Shopee precisa:

- Gerar shortlinks autenticados (chamada GraphQL assinada) para cada produto divulgado
- Marcar cada link com um `subId` para identificar o afiliado que fez a divulgação
- Acompanhar o que cada colaborador gerou
- Manter as credenciais da API protegidas e centralizadas
- Separar contas TEST (sandbox) e PROD (real) sem ter que reconfigurar tudo

Sem uma plataforma, isso normalmente vira planilha + scripts + credenciais espalhadas. O Come Pouco substitui esse caos por uma UI única, com persistência, controle de acesso e log de chamadas.

### Casos de uso suportados

1. **Geração de shortlinks em lote** — afiliado cola até 5 URLs originais e a plataforma devolve as URLs curtas geradas pela Shopee (até 5 por request, configurável em `MAX_BATCH_LINKS`).
2. **Persistência de afiliados gerados** — cada link salvo guarda imagem do produto, frase de chamada, quem gerou e quando.
3. **Modo Sandbox/Mock** — gera shortlinks fake (com hash determinístico) para testes sem consumir cota real da API.
4. **Alternância TEST ↔ PROD** — a mesma empresa pode ter duas credenciais Shopee distintas e trocar com um clique na UI.
5. **Gestão de equipe por empresa** — o `OWNER` da empresa cria seus `EMPLOYEE`s sem precisar do admin global.
6. **Painel admin** — `ADMIN` acompanha consumo agregado da API (chamadas mock vs reais, por empresa), gerencia o servidor de e-mail e cadastra novas empresas/plataformas.
7. **Recuperação de senha por e-mail** — fluxo completo de "esqueci minha senha" com token único expirável.
8. **Autenticação 2FA (TOTP)** — opcional por usuário, com QR Code, códigos de backup e dispositivos confiáveis (lembrar este dispositivo por N dias).
9. **Limpeza automática de histórico** — job diário remove afiliados gerados há mais de N dias (configurável por empresa).

---

## 3. Arquitetura geral

```
                    ┌──────────────────────────────┐
                    │  Browser (Angular 21 + SSR)  │
                    │   http://localhost:4200      │
                    └──────────────┬───────────────┘
                                   │ /api (proxy)
                                   ▼
                    ┌──────────────────────────────┐
                    │  Express 5 + TypeScript      │
                    │   http://localhost:3000      │
                    │   (JWT, CORS, Prisma)        │
                    └──────────┬─────────┬─────────┘
                               │         │
                ┌──────────────▼──┐   ┌──▼──────────────────┐
                │ PostgreSQL 16   │   │ Shopee Affiliate    │
                │ (Docker)        │   │ GraphQL API         │
                │ porta 5432      │   │ (SHA256 signature)  │
                └─────────────────┘   └─────────────────────┘
```

Monorepo com três módulos:

| Pasta                   | Conteúdo                                                       |
|-------------------------|---------------------------------------------------------------|
| `come-pouco-backend/`   | API Express + TypeScript + Prisma + jobs                       |
| `come-pouco-frontend/`  | SPA Angular 21 + Angular Material                              |
| `database/init/`        | Scripts SQL idempotentes carregados pelo entrypoint do Postgres |

---

## 4. Stack de tecnologias

### Backend (`come-pouco-backend/`)

| Camada            | Tecnologia                                                                 |
|-------------------|---------------------------------------------------------------------------|
| Runtime           | **Node.js 22.12.0** (definido em `.nvmrc`)                                |
| Framework HTTP    | **Express 5.2**                                                           |
| Linguagem         | **TypeScript 5.9** (compilado com `tsc`; dev com `ts-node-dev`)           |
| ORM               | **Prisma 7.4** (`@prisma/client` + `@prisma/adapter-pg`)                  |
| Banco             | **PostgreSQL 16** (driver `pg` 8.x)                                       |
| Autenticação      | **JWT** (`jsonwebtoken` 9) + **bcryptjs** para hash de senha              |
| 2FA               | TOTP implementado em `utils/totp.ts` + `qrcode` para o QR de setup        |
| Criptografia      | `crypto` (Node nativo) para AES dos segredos 2FA e assinatura Shopee SHA256 |
| Agendamento       | **node-cron** 4 (job diário de retenção)                                   |
| E-mail (multi)    | **nodemailer** (SMTP) + **@aws-sdk/client-ses** + fetch direto para Resend/SendGrid/Mailgun |
| CORS              | `cors` 2.8 com allow-list configurável e wildcards (`*.dominio.com`)      |
| Config            | `dotenv` 17                                                                |

### Frontend (`come-pouco-frontend/`)

| Camada            | Tecnologia                                                                 |
|-------------------|---------------------------------------------------------------------------|
| Runtime           | **Node.js 22.12.0**                                                       |
| Framework         | **Angular 21.2** (standalone components, signals)                         |
| UI Kit            | **Angular Material 21.2** (theme `azure-blue` pré-construído) + **@angular/cdk** |
| Estado            | Angular **Signals** (`AuthService.currentUser`) + RxJS 7.8                |
| Roteamento        | `@angular/router` com guards funcionais                                   |
| Build             | `@angular/build` (esbuild-based, novo builder)                            |
| Testes            | **Vitest 4** (via `ng test`) + jsdom 28                                   |
| Tipografia        | **Manrope** variable (`@fontsource-variable/manrope`)                     |
| Lint/format       | **Prettier 3.8**                                                          |
| Linguagem         | TypeScript 5.9                                                            |

### Infraestrutura local

| Item              | Tecnologia                                                                 |
|-------------------|---------------------------------------------------------------------------|
| Container DB      | `postgres:16-alpine` via **docker-compose**                               |
| Build de deploy   | **Nixpacks** (`come-pouco-backend/nixpacks.toml`) — alvo Coolify/Railway  |
| Paralelizador     | **concurrently** 9 (no script `npm run dev` do root)                      |

---

## 5. Onde cada coisa roda

| Componente            | Porta padrão | Como subir                                |
|----------------------|--------------|------------------------------------------|
| PostgreSQL            | `5432`       | `npm run db:up` (docker compose)          |
| API (Express)         | `3000`       | `npm run dev:backend` (ts-node-dev)       |
| SPA (Angular)         | `4200`       | `npm run dev:frontend` (ng serve + proxy) |
| Tudo em paralelo      | —            | `npm run dev` (concurrently)              |

O front em dev usa `proxy.conf.json` para redirecionar `/api` ao backend, evitando dor de cabeça com CORS no localhost. Em produção, as duas aplicações são servidas no mesmo domínio e o `environment.prod.ts` mantém `apiUrl: '/api'` como caminho relativo.

---

## 6. Modelo de papéis (RBAC + multi-tenant)

Existem **dois níveis** de papel, ortogonais:

### Nível global — `UserRole`

- **`ADMIN`** — superusuário do sistema. Vê e gerencia tudo: todas as empresas, todas as plataformas, todos os afiliados e o painel de uso da API.
- **`USER`** — operador comum, sempre vinculado a uma empresa via `companyId`.

### Nível empresa — `CompanyRole` (só se aplica quando `UserRole = USER`)

- **`OWNER`** — dono da operação dentro da empresa. Cria/edita seus `EMPLOYEE`s, configura o modo Shopee (TEST/PROD) da empresa, vê os links de toda a equipe.
- **`EMPLOYEE`** — afiliado de campo. Gera links e só enxerga **os próprios links** gerados.

A visibilidade dos `AffiliateLink`s é decidida no service (`affiliate-link.service.ts`) com base nesses dois campos.

---

## 7. Modelo de dados (Prisma)

Esquema completo em [`come-pouco-backend/prisma/schema.prisma`](come-pouco-backend/prisma/schema.prisma).

### Entidades principais

| Tabela                  | Propósito                                                                  |
|-------------------------|---------------------------------------------------------------------------|
| `companies`             | Tenant; guarda `shopeeMode` (TEST/PROD) e `historyRetentionDays`           |
| `users`                 | Usuários globais, com papel + vínculo opcional à empresa + campos de 2FA   |
| `purchase_platforms`    | Credenciais Shopee (`appId`, `secret`, `apiUrl`, `mockMode`, `isActive`)   |
| `company_platforms`     | Join explícito empresa↔plataforma (substitui FKs legadas em `companies`)   |
| `affiliate_links`       | Links gerados (URL original, shortlink, imagem, frase, subId, criador)     |
| `api_request_logs`      | Log de **cada** chamada Shopee (mock ou real, sucesso ou falha)            |
| `two_factor_backup_codes` | Códigos de recuperação 2FA (hash bcrypt, marca `usedAt`)                |
| `trusted_devices`       | Tokens hashed de "dispositivo confiável" (TTL configurável)                |
| `password_reset_tokens` | Tokens UUID hashed para fluxo de "esqueci minha senha"                     |
| `system_email_configs`  | **Linha única** (id=1) com o provedor de e-mail ativo do sistema           |

### Enums

- `UserRole`: `ADMIN` | `USER`
- `CompanyRole`: `OWNER` | `EMPLOYEE`
- `ShopeeMode`: `TEST` | `PROD`
- `ApiRequestMode`: `MOCK` | `REAL`
- `PurchasePlatformType`: `SHOPEE` (preparado para expansão)

### Relacionamentos chave

```
Company 1───N User                            (companyId)
Company 1───N AffiliateLink                   (companyId)
Company N───1 PurchasePlatform × 3            (test, prod, legacy)
Company N───N PurchasePlatform                (via CompanyPlatform)
User    1───N AffiliateLink                   (createdByUserId)
User    1───N ApiRequestLog                   (userId)
User    1───N TwoFactorBackupCode / TrustedDevice / PasswordResetToken
```

---

## 8. Fluxos de uso

### Login + 2FA

```
POST /api/auth/login
  └─ Sem 2FA:  retorna { token, user }
  └─ Com 2FA:  retorna { requiresTwoFactor: true, tempToken }
                  ↓
            POST /api/auth/login/2fa
                  └─ valida TOTP + opcional trustDevice
                  └─ retorna { token, user }
```

JWT (expiração padrão `8h`) é guardado no `localStorage`. O `auth.interceptor.ts` injeta o `Bearer` em toda chamada `/api`, e desloga automaticamente apenas quando o backend devolve `errorCode = AUTH_TOKEN_INVALID | AUTH_TOKEN_EXPIRED` (nunca no meio do fluxo de login).

### Esqueci minha senha

1. `POST /api/auth/forgot-password { email }` → gera token UUID, persiste hash, dispara e-mail via `SystemEmailConfig` ativo
2. Usuário clica no link → frontend abre `/reset-password?token=...`
3. `POST /api/auth/reset-password { token, newPassword }` → valida hash, expiração, atualiza senha e marca token como `usedAt`

### Geração de shortlinks Shopee

`POST /api/integrations/shopee/generate-shortlinks`

```jsonc
{
  "originUrls": ["https://...", "https://..."],  // até 5
  "subId1": "maria_silva",                       // opcional, [A-Za-z0-9_-], máx 50 chars
  "platformId": 7                                // opcional, só ADMIN pode passar
}
```

Pipeline interno (controller `integration.controller.ts`):

1. Valida URLs e `subId1` (regex `^[A-Za-z0-9_-]+$`)
2. **Resolve a plataforma**:
   - `ADMIN`: usa `platformId` informado, ou a única plataforma `SHOPEE` ativa
   - `OWNER/EMPLOYEE`: usa o vínculo `CompanyPlatform` da empresa (fallback para a FK legada)
3. Valida que a plataforma é `SHOPEE`, ativa, e (se não-mock) tem `appId` + `secret`
4. Se `platform.mockMode || SHOPEE_MOCK=true`:
   - Gera shortlinks fake `https://shopee.mock/s/<hash sha256 truncado>`
   - Loga em `ApiRequestLog` com `mode='MOCK'`
5. Caso contrário:
   - Para cada URL, dispara GraphQL `generateShortLink` autenticado com header `Authorization: SHA256 Credential=<appId>, Timestamp=<ms>, Signature=<sha256(appId+timestamp+payload+secret)>`
   - Loga cada chamada em `ApiRequestLog` com `mode='REAL'`

### Salvamento do afiliado

Depois de gerar, o frontend chama `POST /api/affiliate-links` para persistir os links válidos com imagem do produto, frase de chamada e o usuário criador.

---

## 9. Segurança e hardening

- **Senhas**: bcryptjs com 10 rounds (default).
- **JWT**: assinatura HS256, `JWT_SECRET` obrigatório em produção (boot falha se for o default).
- **Segredo TOTP**: cifrado em repouso com AES (chave `TWOFA_ENCRYPTION_KEY` obrigatória em produção).
- **Trusted device**: token aleatório enviado em cookie httpOnly + hash persistido; `TRUSTED_DEVICE_DAYS=30` por padrão.
- **CORS**: allow-list explícita por env (`CORS_ORIGINS`), com suporte a wildcards `*.dominio.com`. Em dev, origens bloqueadas são logadas para diagnóstico.
- **Erros padronizados**: todo erro de API segue `{ message, errorCode, details? }`. `details` só vaza em `APP_ENV=development`.
- **Boot defensivo**: em dev, o servidor valida no startup que as colunas de 2FA existem e que o admin master está semeado (`ensureDatabaseSchema`). Em produção, esses checks são pulados para não bloquear deploys.
- **Códigos de erro de auth** (não exaustivo): `AUTH_TOKEN_MISSING`, `AUTH_TOKEN_INVALID`, `AUTH_TOKEN_EXPIRED`, `AUTH_INVALID_CREDENTIALS`, `AUTH_INVALID_2FA_CODE`, `AUTH_2FA_*`, `AUTH_TRUSTED_DEVICE_NOT_FOUND`, `AUTH_SCHEMA_OUTDATED`, `AUTH_FORBIDDEN`.

---

## 10. Sistema de e-mail (multi-provedor)

A tabela `system_email_configs` armazena um único registro (id=1) com o provedor ativo. O serviço `email.service.ts` resolve dinamicamente entre:

- **SMTP** (`nodemailer` — qualquer servidor)
- **Resend** (HTTP API)
- **AWS SES** (`@aws-sdk/client-ses`)
- **SendGrid** (HTTP API)
- **Mailgun** (HTTP API)

O `ADMIN` configura tudo pela UI em `/admin/email-settings` e tem um botão **"Enviar e-mail de teste"** que dispara para o e-mail do próprio admin antes de salvar.

Hoje o e-mail é usado para:

- Reset de senha (template em `services/email/password-reset.template.ts`)
- Testes de configuração

---

## 11. Job de retenção

Implementado em `jobs/history-cleanup.job.ts`. Agenda: `0 3 * * *` (todo dia às 03:00, horário do servidor).

```sql
DELETE FROM affiliate_links al
USING companies c
WHERE al.company_id = c.id
  AND c.history_retention_days > 0
  AND al.created_at < NOW() - (c.history_retention_days * INTERVAL '1 day');
```

A retenção é **configurada por empresa** (`Company.historyRetentionDays`, default 30, valores permitidos: 7, 15, 30, 60, 90, 180, 365). Empresas com `0` ou `NULL` são puladas (retenção infinita).

Há trava de concorrência via flag `isRunning` para o caso raríssimo de o cron disparar enquanto a execução anterior ainda está em andamento.

---

## 12. Endpoints REST resumidos

Base: `http://localhost:3000/api`

| Método | Rota                                          | Acesso                  |
|--------|-----------------------------------------------|-------------------------|
| GET    | `/health`                                     | público                 |
| POST   | `/auth/login`                                 | público                 |
| POST   | `/auth/login/2fa` (alias `/auth/2fa/verify`)  | público                 |
| POST   | `/auth/register`                              | público + autenticado   |
| POST   | `/auth/forgot-password` `/auth/reset-password`| público                 |
| GET    | `/auth/me`                                    | autenticado             |
| POST   | `/auth/2fa/setup` `/confirm` `/disable`       | autenticado             |
| GET/DEL| `/auth/trusted-devices(/:id)`                 | autenticado             |
| GET    | `/dashboard/production-summary`               | autenticado             |
| CRUD   | `/users` + `POST /users/employees`            | autenticado (RBAC)      |
| CRUD   | `/companies`                                  | ADMIN                   |
| CRUD   | `/affiliate-links`                            | autenticado (escopo)    |
| CRUD   | `/purchase-platforms` + `/:id/companies`      | autenticado (ADMIN p/ mutações) |
| POST   | `/integrations/shopee/generate-shortlinks`    | autenticado             |
| GET    | `/admin/api-usage` `DELETE /api-usage/mock`   | ADMIN                   |
| POST   | `/admin/users/:id/reset-2fa`                  | ADMIN                   |
| GET/PUT/POST | `/admin/email-config(/test)`            | ADMIN                   |

---

## 13. Frontend — páginas

Todas as rotas (exceto `login`, `register`, `forgot-password`, `reset-password`) ficam dentro de `AppLayoutComponent`, atrás do `authGuard`.

| Rota                         | Componente                  | Guard                  |
|------------------------------|-----------------------------|------------------------|
| `/login`                     | LoginComponent              | `guestGuard`           |
| `/forgot-password`           | ForgotPasswordComponent     | `guestGuard`           |
| `/reset-password`            | ResetPasswordComponent      | —                      |
| `/register`                  | RegisterComponent           | `noPublicRegisterGuard`|
| `/home`                      | HomeComponent               | `authGuard`            |
| `/affiliate-links`           | AffiliateLinksComponent     | `authGuard`            |
| `/users` `/users/new`        | UsersComponent              | `adminGuard` / `usersCreateGuard` |
| `/companies`                 | CompaniesComponent          | `adminGuard`           |
| `/my-company`                | MyCompanyComponent          | `ownerGuard`           |
| `/purchase-platforms`        | PurchasePlatformsComponent  | `adminGuard`           |
| `/admin/email-settings`      | AdminEmailSettingsComponent | `adminGuard`           |
| `/security`                  | SecurityComponent           | `authGuard`            |

A home (`HomeComponent`) mostra um painel de **Saúde da Produção** consumindo `/dashboard/production-summary`: total de links gerados hoje, média/mín/máx dos últimos 7 dias.

---

## 14. Workflow de desenvolvimento

```bash
# 1. Subir Postgres
npm run db:up

# 2. Instalar deps em todos os módulos (postinstall faz isso automaticamente)
npm install

# 3. Subir back + front em paralelo
npm run dev

# Type-check rápido do backend
npm run check:backend

# Aplicar migrations de schema
npm --prefix come-pouco-backend run prisma:migrate

# Build completo (back + front em paralelo + prisma:deploy)
npm run build

# Smoke test end-to-end (login admin → cria empresa → gera shortlink → cleanup)
npm run smoke:postdeploy
```

### Credenciais de teste local

- **Usuário:** `admin`
- **Senha:** `comepouco102030@`

Seed inicial está em `database/init/*.sql` (idempotente, carregado pelo entrypoint do Postgres na primeira subida do volume).

---

## 15. Deploy

A pasta `come-pouco-backend/` traz um `nixpacks.toml` que define as fases de install/build/start para deploy em plataformas tipo **Coolify**, **Railway** ou similar.

Em produção:

- `npm run start:prod` aplica migrations (`prisma migrate deploy`) e inicia o servidor compilado
- `JWT_SECRET` e `TWOFA_ENCRYPTION_KEY` precisam ser definidos (boot falha caso contrário)
- O frontend Angular é compilado com `ng build` (output em `come-pouco-frontend/dist/`) e servido como assets estáticos pelo proxy do domínio
- O smoke test (`smoke:postdeploy`) pode ser executado contra a URL de produção apontando `POST_DEPLOY_SMOKE_BASE_URL`

Detalhes adicionais para ambientes legados (sem histórico completo do Prisma) em [`come-pouco-backend/docs/db-baseline.md`](come-pouco-backend/docs/db-baseline.md).

---

## 16. Resumo executivo

> **Come Pouco** é um SaaS multi-tenant em Node/Express + Angular que substitui planilhas e scripts manuais na operação de marketing de afiliados Shopee. Empresas cadastram suas credenciais, distribuem acesso para seus afiliados, e geram em lote shortlinks assinados via GraphQL — com 2FA, controle de papéis em dois níveis, retenção configurável, painel de uso e modo sandbox para testes sem queimar cota da API.

---

## 17. Plano de desenvolvimento

Roadmap de evolução da aplicação rumo a um padrão **primeira categoria** (produção robusta, observável, testada e segura).

### Estrutura

A hierarquia do plano segue sempre **três níveis**:

```
Fase N — <objetivo macro / marco>
├── Task N.M — <entrega concreta>
│   ├── Subtask N.M.K — <passo atômico, idealmente 1 PR>
│   ├── Subtask N.M.K — ...
│   └── Subtask N.M.K — ...
└── Task N.M — ...
```

- **Fase** — bloco temático ou marco de evolução (ex.: "Fundação de Qualidade", "Observabilidade", "Escalabilidade"). Cada fase tem um objetivo claro e um critério de "pronta".
- **Task** — entrega de valor mensurável dentro da fase (ex.: "Cobertura de testes do backend > 70%", "Pipeline de CI verde"). Cada task tem critério de aceite.
- **Subtask** — passo atômico que cabe num PR/commit (ex.: "Configurar Vitest no backend", "Adicionar workflow GitHub Actions").

### Convenções

Cada Task descreve:

- **Objetivo** — o que será entregue e por quê
- **Critério de aceite** — como saber que terminou
- **Dependências** — outras Tasks/Fases que precisam estar prontas antes
- **Notas técnicas** — escolhas, bibliotecas, riscos relevantes

Cada Subtask é redigida no infinitivo ("Adicionar X", "Configurar Y") e idealmente cabe em **um único PR pequeno e revisável**.

### Princípios que guiam todas as fases

- **Boas práticas sempre** — SOLID, clean code, separação de responsabilidades, testes próximos do código que testam
- **Sem regressão funcional** — cada Fase mantém a aplicação rodando e os fluxos atuais saudáveis
- **Pequenos passos verificáveis** — cada Subtask termina com a aplicação compilando e funcionando
- **Observabilidade desde cedo** — logs, métricas e erros estruturados antes de virem problemas
- **Segurança não é opcional** — toda mudança considera autenticação, autorização e proteção de dados
- **Documentação viva** — CLAUDE.md, IDEIA.md e READMEs atualizados conforme a aplicação evolui

### Fases planejadas

---

### Fase 1 — Design System & Redesign Visual

**Objetivo da fase**: substituir o visual genérico do Angular Material por uma identidade própria — minimalista moderna (referências: Linear, Vercel, Stripe) — com design system documentado, dark mode nativo e responsividade mobile-first. Ao final, login, app shell e todas as páginas principais terão sido redesenhados sem regressão funcional.

**Critério de "pronta"**:
- Design tokens (cores, tipografia, espaçamento, raios, sombras, motion) definidos e documentados
- Angular Material 21 com tema customizado MD3 (sem `azure-blue` pré-construído)
- Tailwind CSS integrado ao build, coexistindo com SCSS
- Dark mode com toggle, persistência e respeito a `prefers-color-scheme`
- Todas as 14+ telas funcionando em viewport mobile (375px) sem quebra de layout
- Auditoria WCAG AA básica passando

**Stack escolhido**: Angular Material 21 (mantido) + Tailwind CSS + tema MD3 customizado + ícones Lucide.

---

#### Task 1.1 — Identidade visual e design tokens

- **Objetivo**: definir a linguagem visual da aplicação (paleta, tipografia, espaçamento, raios, sombras, motion) e materializá-la como design tokens reutilizáveis. Sem isso, o resto da fase fica sem fundação.
- **Critério de aceite**:
  - 3 propostas de paleta apresentadas (light + dark cada), uma escolhida
  - Hierarquia tipográfica baseada em Manrope (display, h1-h6, body, caption, code)
  - Escala de espaçamento base 4px (0, 1, 2, 3, 4, 6, 8, 12, 16, 24)
  - Tokens semânticos definidos: `background`, `foreground`, `primary`, `accent`, `muted`, `border`, `success`, `warning`, `danger`
  - Documento `DESIGN.md` na raiz descrevendo todas as decisões
- **Dependências**: nenhuma
- **Notas técnicas**: tokens expostos como CSS custom properties (`--cp-color-primary` etc.) para alternância light/dark sem recompilar. Tailwind consome esses tokens via `theme.extend.colors`. Manrope já está no projeto (`@fontsource-variable/manrope`).

**Subtasks**:
- [ ] **1.1.1** — Pesquisar e elaborar 3 propostas de paleta no estilo minimalista moderno (uma "neutra elegante", uma "com acento vibrante", uma "monocromática contrastada"), com versões light + dark
- [ ] **1.1.2** — Apresentar as propostas em arquivo `DESIGN.md` com swatches em hex/HSL + justificativa de cada escolha
- [ ] **1.1.3** — Definir hierarquia tipográfica completa (tamanhos, pesos, line-height, letter-spacing) baseada em Manrope variable
- [ ] **1.1.4** — Definir escala de espaçamento, raios de borda (sm/md/lg/full) e shadows (sm/md/lg/xl) compatíveis com a estética minimal
- [ ] **1.1.5** — Definir tokens de motion (easings + duração curta/média/longa) para animações sutis
- [ ] **1.1.6** — Consolidar todos os tokens em `DESIGN.md` e validar com o usuário antes de seguir

---

#### Task 1.2 — Infraestrutura de styling (Tailwind + tema MD3 + dark mode)

- **Objetivo**: preparar o terreno técnico para aplicar a identidade visual em qualquer componente, e habilitar dark mode end-to-end.
- **Critério de aceite**:
  - Tailwind CSS instalado e configurado, sem conflito com Angular Material
  - Tema Material 3 customizado consumindo os tokens da Task 1.1
  - CSS variables alternando entre light/dark via classe `.dark` no `<html>`
  - `ThemeService` (signals) com persistência em `localStorage` + respeito a `prefers-color-scheme`
  - Toggle de tema funcional em qualquer parte da UI
- **Dependências**: Task 1.1
- **Notas técnicas**: Tailwind v4 traz config CSS-first que casa bem com tokens em custom properties; Material 3 expõe `mat.theme()` para definir paleta dinamicamente. Atenção: o tema `azure-blue` no `angular.json` precisa sair junto.

**Subtasks**:
- [ ] **1.2.1** — Instalar `tailwindcss` + plugin postcss e configurar `tailwind.config.ts` / `styles.scss`
- [ ] **1.2.2** — Criar `src/styles/tokens.scss` com todas as CSS variables dos tokens (light) e o bloco `.dark { }` (dark)
- [ ] **1.2.3** — Estender `theme.extend` do Tailwind para consumir os tokens (`colors.primary: 'var(--cp-color-primary)'` etc.)
- [ ] **1.2.4** — Remover `azure-blue` do `angular.json` e definir tema MD3 custom via `mat.theme()` consumindo os mesmos tokens
- [ ] **1.2.5** — Criar `ThemeService` com signal `currentTheme` (`'light' | 'dark' | 'system'`), persistência e listener do `prefers-color-scheme`
- [ ] **1.2.6** — Adicionar toggle de tema (componente reutilizável) — uso final na topbar acontece na Task 1.5
- [ ] **1.2.7** — Smoke visual: rodar a app, alternar tema, confirmar que componentes Material existentes herdam corretamente

---

#### Task 1.3 — Biblioteca de componentes compartilhados

- **Objetivo**: criar a camada de componentes reutilizáveis que o redesign vai usar. Isso evita estilos espalhados pelas páginas e garante consistência visual.
- **Critério de aceite**:
  - Componentes presentes em `shared/components/`: `AppLogo`, `PageHeader`, `EmptyState`, `SkeletonLoader`, `StatusChip`, `ThemeToggle`, `IconButton`
  - Lucide icons instalado (`lucide-angular`), substituindo `mat-icon` onde fizer sentido
  - `ConfirmDialog` existente refatorado com o novo estilo
  - Todos os componentes funcionam em light e dark
- **Dependências**: Task 1.2
- **Notas técnicas**: `lucide-angular` é o equivalente Angular do lucide-react — ícones modernos, peso configurável, tree-shakeable. Não substitui 100% do `mat-icon` (alguns componentes Material esperam font icons), mas cobre 90% dos usos próprios.

**Subtasks**:
- [ ] **1.3.1** — Instalar `lucide-angular` e criar wrapper `IconComponent` (padroniza tamanho/peso)
- [ ] **1.3.2** — Criar `AppLogoComponent` (SVG inline, responde ao tema)
- [ ] **1.3.3** — Criar `PageHeaderComponent` (título + descrição + ações slot)
- [ ] **1.3.4** — Criar `EmptyStateComponent` (ícone + título + descrição + CTA opcional)
- [ ] **1.3.5** — Criar `SkeletonLoaderComponent` (variantes: text, card, table-row, avatar)
- [ ] **1.3.6** — Criar `StatusChipComponent` (variantes semânticas: success, warning, danger, info, neutral)
- [ ] **1.3.7** — Criar `ThemeToggleComponent` consumindo `ThemeService`
- [ ] **1.3.8** — Refatorar `ConfirmDialogComponent` com novo estilo (ícone, hierarquia tipográfica, ações alinhadas)

---

#### Task 1.4 — Redesign do fluxo de autenticação

- **Objetivo**: dar ao login a primeira impressão à altura — split-screen, identidade da marca, microinterações sutis. Estender o mesmo padrão para todos os fluxos de auth (register, forgot, reset, 2FA setup, 2FA challenge).
- **Critério de aceite**:
  - `LoginComponent` em layout split-screen (formulário + painel visual), responsivo
  - Toggle de mostrar/esconder senha, loading state no botão, mensagens de erro inline
  - `ForgotPasswordComponent`, `ResetPasswordComponent`, `RegisterComponent` no mesmo padrão visual
  - Fluxo de 2FA (challenge no login + setup em `/security`) redesenhado com QR centralizado, input de 6 dígitos estilizado, códigos de backup em grid
  - Animações de transição entre etapas (sem ser exagerado)
- **Dependências**: Task 1.3
- **Notas técnicas**: criar um `AuthShellComponent` que serve de layout pra todas as páginas públicas. Input de TOTP pode ser um conjunto de 6 inputs com auto-focus (boa UX).

**Subtasks**:
- [ ] **1.4.1** — Criar `AuthShellComponent` (split-screen: form à esquerda, painel da marca à direita; colapsa em mobile)
- [ ] **1.4.2** — Redesenhar `LoginComponent` (form polido, password toggle, loading, erros inline)
- [ ] **1.4.3** — Redesenhar `ForgotPasswordComponent` (estado de sucesso destacado, retry após envio)
- [ ] **1.4.4** — Redesenhar `ResetPasswordComponent` (force de senha visual, requisitos checklist)
- [ ] **1.4.5** — Redesenhar `RegisterComponent` (form sectioned, validações inline)
- [ ] **1.4.6** — Criar `OtpInputComponent` (6 inputs auto-focus, paste handling, keyboard nav)
- [ ] **1.4.7** — Redesenhar fluxo 2FA challenge (continuação do login após `requiresTwoFactor`)
- [ ] **1.4.8** — Redesenhar 2FA setup (`/security`): QR code com fallback de chave manual, confirmação, exibição/download dos backup codes

---

#### Task 1.5 — Redesign do app shell (sidebar + topbar)

- **Objetivo**: navegação moderna, com seções colapsáveis, indicador de rota ativa, topbar com user menu + theme toggle, breadcrumbs derivados da rota.
- **Critério de aceite**:
  - Sidebar com agrupamento lógico (`Operação`, `Administração`, `Conta`), ícones Lucide, indicador de ativo
  - Sidebar colapsável em desktop (modo "rail" só com ícones), e drawer em mobile com overlay
  - Topbar com avatar + dropdown de usuário (perfil, segurança, logout), theme toggle, breadcrumbs
  - Mobile: hamburger abre drawer; topbar simplificada
  - Layout fluido sem scrollbars horizontais em qualquer viewport
- **Dependências**: Task 1.3
- **Notas técnicas**: usar `BreakpointObserver` do CDK para alternar entre sidebar fixa e drawer. Breadcrumbs podem ser derivados de `route.data` (configurar nas rotas).

**Subtasks**:
- [ ] **1.5.1** — Estruturar `AppLayoutComponent` com grid CSS (sidebar fixa | conteúdo | opcional aside)
- [ ] **1.5.2** — Criar `SidebarComponent` com itens agrupados, indicador ativo, modo collapsed/expanded
- [ ] **1.5.3** — Aplicar visibilidade por papel: itens admin só pra `ADMIN`, "Minha Empresa" só pra `OWNER`, etc.
- [ ] **1.5.4** — Criar `TopbarComponent` com user menu + theme toggle + breadcrumbs slot
- [ ] **1.5.5** — Configurar `data.breadcrumb` nas rotas e criar `BreadcrumbsComponent`
- [ ] **1.5.6** — Mobile: hamburger toggle + drawer com overlay (CDK `Overlay` ou `MatSidenav` em modo `over`)
- [ ] **1.5.7** — Persistir estado de sidebar colapsada no `localStorage`

---

#### Task 1.6 — Redesign das páginas internas

- **Objetivo**: aplicar a nova linguagem visual em cada página, com padrões consistentes: page header, ações no topo direito, empty states, skeletons no carregamento.
- **Critério de aceite**:
  - Cada página usa `PageHeaderComponent`, `EmptyStateComponent`, `SkeletonLoaderComponent` quando aplicável
  - Tabelas com busca, filtros visíveis, paginação e linha de seleção polidas
  - Formulários com validação inline + estados de loading + mensagens de erro padronizadas
  - Snackbar e dialogs com novo estilo
- **Dependências**: Task 1.5
- **Notas técnicas**: a página `affiliate-links` é a mais densa — vale tempo extra. Considerar `MatTable` + `MatSort` + `MatPaginator` ou substituir por solução customizada se ficar limitada.

**Subtasks**:
- [ ] **1.6.1** — `HomeComponent`: cards de KPI polidos (todayCount, avg/min/max 7 dias), com sparkline opcional, atalhos por papel
- [ ] **1.6.2** — `AffiliateLinksComponent`: tabela moderna (filtros, busca, paginação, seleção múltipla, ações em massa, preview do link/imagem)
- [ ] **1.6.3** — `AffiliateLinksResultsDialogComponent`: dialog de resultados pós-geração com status por linha (success/error/saved)
- [ ] **1.6.4** — `UsersComponent`: lista + formulário de criação/edição com hierarquia visual clara
- [ ] **1.6.5** — `CompaniesComponent`: lista + formulário, vínculo de plataformas Shopee TEST/PROD destacado
- [ ] **1.6.6** — `PurchasePlatformsComponent`: lista + form com badge de modo (mock/active/inactive)
- [ ] **1.6.7** — `MyCompanyComponent`: form sectioned (dados, plataformas, retenção, equipe)
- [ ] **1.6.8** — `SecurityComponent`: cards de 2FA (setup/disable) + lista de trusted devices com revogação
- [ ] **1.6.9** — `AdminEmailSettingsComponent`: form por provedor (radio de SMTP/Resend/SES/etc.) + botão de teste

---

#### Task 1.7 — Responsividade mobile-first

- **Objetivo**: garantir que toda a aplicação é confortável de usar em telefones (≥375px) e tablets, não só em desktop.
- **Critério de aceite**:
  - Nenhuma página tem scroll horizontal indesejado em 375/414/768/1024px
  - Tabelas viram cards em mobile (ou scroll horizontal explícito quando faz sentido)
  - Formulários full-width em mobile, com inputs grandes (≥44px de altura tocável)
  - Sidebar vira drawer; topbar simplifica
  - Modais e drawers ocupam 100% em mobile
- **Dependências**: Task 1.6
- **Notas técnicas**: usar breakpoints do Tailwind (`sm 640 / md 768 / lg 1024 / xl 1280`). Tabelas-em-cards é o ponto mais trabalhoso — talvez criar um `ResponsiveTableComponent` que aceite "card template" pra mobile.

**Subtasks**:
- [ ] **1.7.1** — Auditar cada página em viewports 375/768/1024 e listar quebras
- [ ] **1.7.2** — Criar `ResponsiveTableComponent` (renderiza tabela em ≥md, cards em <md)
- [ ] **1.7.3** — Aplicar em `AffiliateLinksComponent`, `UsersComponent`, `CompaniesComponent`, etc.
- [ ] **1.7.4** — Revisar formulários: inputs ≥44px, espaçamento generoso, labels acima em mobile
- [ ] **1.7.5** — Revisar diálogos: full-screen em mobile (`MatDialog` config `maxWidth: 100vw`)
- [ ] **1.7.6** — Validar em dispositivo real (ou DevTools com throttling)

---

#### Task 1.8 — Acessibilidade & polimento final

- **Objetivo**: subir o padrão de WCAG AA, microinterações sutis e animações que dão sensação "premium" sem atrapalhar.
- **Critério de aceite**:
  - Lighthouse Accessibility ≥ 95 em todas as páginas principais
  - Navegação por teclado completa (Tab, Enter, Esc, setas em listas/tabelas)
  - Contraste auditado em light e dark
  - Animações de entrada/saída em dialogs, drawers e transições de rota
  - `prefers-reduced-motion` respeitado
- **Dependências**: Task 1.6
- **Notas técnicas**: usar `axe-core` para auditoria automatizada (`@axe-core/playwright` se montar e2e mais tarde). Angular Animations já vem com `provideAnimations()` no projeto.

**Subtasks**:
- [ ] **1.8.1** — Auditar contraste de todos os tokens (light + dark) com ferramenta tipo Stark/Contrast
- [ ] **1.8.2** — Adicionar `aria-label` em ícones-botão e elementos não-textuais
- [ ] **1.8.3** — Garantir foco visível custom (outline coerente com tokens) em todos os elementos focáveis
- [ ] **1.8.4** — Adicionar animação de transição de rota (`@angular/animations`)
- [ ] **1.8.5** — Adicionar microinterações em hover/active de cards e botões
- [ ] **1.8.6** — Respeitar `@media (prefers-reduced-motion: reduce)` desativando animações não-essenciais
- [ ] **1.8.7** — Auditoria com Lighthouse e ajustes finais

---

### Fase 2 — Segurança & Performance (Backend + Banco)

**Objetivo da fase**: levar o backend e o banco do "funciona" para o "configurado com o básico bem-feito" — sem buscar nível bancário, mas eliminando vetores óbvios (brute-force, segredos em texto plano, payloads gigantes, ausência de paginação) e ganhando observabilidade mínima via audit log. Sem mudar a arquitetura macro (sem Redis, sem refresh tokens — adiados pra fase futura).

**Critério de "pronta"**:
- Headers de segurança configurados (helmet), body limit explícito, compression ativa, request-id em todo log
- Rate limit em-memória em endpoints de auth e geração de shortlinks
- Schemas de validação (zod) em todos os endpoints com entrada de dados
- Credenciais sensíveis (`PurchasePlatform.secret`, API keys de e-mail) cifradas em repouso
- `AuditLog` registrando login OK/falha, troca de senha, mudanças de 2FA, e CRUD admin em entidades sensíveis
- Paginação em todas as list endpoints; índices faltantes adicionados; cache curto de user no `authMiddleware`
- Cleanup job estendido para `ApiRequestLog` e `AuditLog`

**Decisões macro tomadas**:
- Sem Redis nessa fase (in-memory para rate limit e cache)
- JWT continua em localStorage (refresh-token fica para fase posterior)
- Audit log é tabela dedicada, cobrindo auth + ações admin

---

#### Task 2.1 — Hardening HTTP & middlewares de proteção

- **Objetivo**: blindar o Express com as proteções padrão da indústria que faltam hoje: headers de segurança, limite de payload, compression, rate limit e correlation ID nos logs. Também elimina a duplicidade do `/auth/register` que abre registro público sem querer.
- **Critério de aceite**:
  - `helmet` ativo com configuração revisada (CSP em `report-only` pra não quebrar UI; `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` ativos)
  - `express.json({ limit: '256kb' })` explícito (revisar tamanho real esperado)
  - `compression` middleware ativo (gzip + brotli quando suportado)
  - Middleware `requestId` que injeta UUID em `req.id` + header `X-Request-Id` na resposta + logs estruturados consomem esse id
  - Rate limit em-memória em `/auth/login` (5 tentativas / 15min / IP), `/auth/login/2fa` (10/15min), `/auth/forgot-password` (3/h/IP), `/integrations/shopee/generate-shortlinks` (30/min/user)
  - `/auth/register` aparece **uma só vez** — público OU autenticado, decidido com o usuário (default: gated por `noPublicRegisterGuard`-equivalente no backend)
- **Dependências**: nenhuma
- **Notas técnicas**: `helmet` v8, `express-rate-limit` v7 (suporta `keyGenerator` para IP/user). Como estamos atrás de proxy (Coolify), configurar `app.set('trust proxy', 1)` pra que IP seja o real. Limites são parâmetros — comece conservador e relaxe sob demanda.

**Subtasks**:
- [ ] **2.1.1** — Instalar `helmet` + ativar no `app.ts` antes dos demais middlewares
- [ ] **2.1.2** — Configurar `app.set('trust proxy', 1)` e CSP em `report-only` inicial
- [ ] **2.1.3** — Adicionar `limit: '256kb'` no `express.json()` e `express.urlencoded()` se aplicável
- [ ] **2.1.4** — Instalar e ativar `compression` middleware
- [ ] **2.1.5** — Criar middleware `requestId` (UUID v4) e propagar header de resposta `X-Request-Id`
- [ ] **2.1.6** — Instalar `express-rate-limit`, criar factory `buildAuthRateLimiter` parametrizada (janela, max, key)
- [ ] **2.1.7** — Aplicar rate limit nos endpoints de auth e em `/integrations/shopee/generate-shortlinks`
- [ ] **2.1.8** — Remover a duplicidade de `/auth/register` em [`auth.routes.ts`](come-pouco-backend/src/routes/auth.routes.ts) e gatear no backend (não confiar só no guard do front)
- [ ] **2.1.9** — Smoke test: rodar `npm run auth:smoke` + bater nos endpoints e confirmar headers + 429 quando esperado

---

#### Task 2.2 — Validação de entrada baseada em schema (zod)

- **Objetivo**: substituir a validação manual espalhada nos controllers por schemas declarativos. Padroniza mensagens de erro, elimina checks redundantes e dá tipagem ponta-a-ponta. Inclui regras de força de senha server-side (hoje só client-side).
- **Critério de aceite**:
  - `zod` instalado e configurado
  - Middleware genérico `validate({ body?, query?, params? })` que devolve `400 VALIDATION_ERROR` com lista de erros estruturada
  - Todos os controllers que recebem input migrados para usar schemas
  - Tipos dos handlers inferidos do schema (`z.infer<typeof schema>`)
  - Regras de senha server-side: mín 10 chars, ao menos 1 letra + 1 número, sem espaços, sem repetições óbvias
- **Dependências**: nenhuma (idealmente antes da Task 2.3)
- **Notas técnicas**: zod tem boa interop com TypeScript. Mensagens em PT-BR via `z.setErrorMap` customizado. Para `subId1` (regex existente) e URLs no Shopee, o schema substitui os checks manuais em [`integration.controller.ts`](come-pouco-backend/src/controllers/integration.controller.ts).

**Subtasks**:
- [ ] **2.2.1** — Instalar `zod` e criar `src/utils/validate.ts` com middleware genérico
- [ ] **2.2.2** — Definir `errorMap` em PT-BR e padrão de resposta `{ errorCode: 'VALIDATION_ERROR', details: [...] }`
- [ ] **2.2.3** — Criar schemas em `src/schemas/` agrupados por domínio (auth, users, companies, affiliate-links, integration, admin)
- [ ] **2.2.4** — Migrar `auth.controller` (login, login/2fa, register, forgot, reset, 2fa setup/confirm/disable)
- [ ] **2.2.5** — Migrar `integration.controller` (originUrls, subId1, platformId) — substitui validação manual
- [ ] **2.2.6** — Migrar `affiliate-link.controller`, `user.controller`, `company.controller`, `purchase-platform.controller`, `admin-*.controller`
- [ ] **2.2.7** — Adicionar regras de força de senha no schema de register/reset/2FA disable (sem quebrar passwords existentes — só nova senha)
- [ ] **2.2.8** — Remover código de validação manual obsoleto dos controllers

---

#### Task 2.3 — Auth hardening (lockout, sessões, anti-enumeração)

- **Objetivo**: cobrir os pontos restantes da auditoria de auth: bloqueio progressivo após falhas, invalidação de sessões ativas em troca de senha, resposta uniforme em forgot-password (anti-enumeração de e-mails), e sanitização de stack trace em prod.
- **Critério de aceite**:
  - Após 5 falhas consecutivas em `/auth/login` no mesmo `identifier`, próximas tentativas retornam 429 por 15min (lockout granular por usuário, não só por IP do rate limiter)
  - Coluna `passwordChangedAt` em `users`; JWTs emitidos antes desse timestamp são considerados inválidos pelo `authMiddleware`
  - Troca de senha (reset + setup futuro) atualiza `passwordChangedAt` → expulsa todas as sessões antigas
  - `/auth/forgot-password` sempre retorna sucesso genérico, independente do e-mail existir (mas só envia e-mail se existir)
  - Erros 500 em produção devolvem mensagem genérica + `requestId` (full stack só no log, nunca no body)
- **Dependências**: Task 2.2 (schemas), Task 2.1 (request-id pra incluir no log de stack)
- **Notas técnicas**: lockout pode reusar `express-rate-limit` com `keyGenerator` por `identifier` em vez de IP. `passwordChangedAt` aproveita JWT `iat` (issued-at) — comparar `iat` com `passwordChangedAt.getTime()/1000`.

**Subtasks**:
- [ ] **2.3.1** — Adicionar coluna `password_changed_at` em `users` (migration Prisma)
- [ ] **2.3.2** — Atualizar `passwordChangedAt` em `auth.service` ao trocar senha (reset + futuro change-password)
- [ ] **2.3.3** — Modificar `auth.middleware` pra rejeitar JWTs com `iat < passwordChangedAt`
- [ ] **2.3.4** — Implementar lockout por `identifier` em `/auth/login` e `/auth/login/2fa` (5 falhas/15min)
- [ ] **2.3.5** — Padronizar resposta de `/auth/forgot-password` (sempre `200 { message: 'Se o e-mail existir, enviamos instruções.' }`)
- [ ] **2.3.6** — Sanitizar erros 500: handler global devolve `{ message: 'Erro interno', errorCode: 'INTERNAL_ERROR', requestId }` em prod; stack vai só pro `console.error` com request-id
- [ ] **2.3.7** — Smoke test: tentar 6 logins errados, confirmar 429 no 6º; trocar senha e confirmar logout automático em outra aba

---

#### Task 2.4 — Criptografia at-rest de segredos sensíveis

- **Objetivo**: aplicar AES-256-GCM (mesmo padrão usado em `twoFactorSecret`) nas credenciais Shopee e API keys de e-mail. Hoje estão em texto plano no DB — qualquer dump expõe a operação inteira.
- **Critério de aceite**:
  - Helper centralizado `src/utils/encryption.ts` com `encryptSecret(plaintext)` / `decryptSecret(ciphertext)` reutilizando `TWOFA_ENCRYPTION_KEY` (ou nova `SECRETS_ENCRYPTION_KEY` se quisermos separar — a definir)
  - Campos cifrados: `PurchasePlatform.secret`, `SystemEmailConfig.{smtpPassword, resendApiKey, sesSecretKey, mailgunApiKey, sendgridApiKey}`
  - Services aplicam encrypt no write e decrypt no read transparentemente
  - Migration de dados: cifra valores em texto plano existentes (idempotente)
  - Respostas da API mascaram secrets: retorna só `last4` ou `••••` em vez do valor decifrado para listagens/edição
- **Dependências**: nenhuma
- **Notas técnicas**: `utils/crypto.ts` já tem implementação AES — verificar se serve direto ou precisa adaptação. Migration tem que detectar se valor já está cifrado (prefixo, ou check de formato) pra ser idempotente. Cuidado em rotação de chave: documentar processo.

**Subtasks**:
- [ ] **2.4.1** — Auditar `utils/crypto.ts` atual e extrair/criar `encryptSecret`/`decryptSecret` reutilizáveis
- [ ] **2.4.2** — Decidir chave: reusar `TWOFA_ENCRYPTION_KEY` OU criar `SECRETS_ENCRYPTION_KEY` separada (default: reusar, com nota pra rotação futura)
- [ ] **2.4.3** — Atualizar `purchase-platform.service`: encrypt no create/update, decrypt apenas onde a secret é usada (chamada Shopee)
- [ ] **2.4.4** — Atualizar `system-email-config.service`: encrypt/decrypt nos 5 campos sensíveis
- [ ] **2.4.5** — Criar migration de dados (script idempotente que cifra valores plaintext existentes — usar tag como `enc:v1:` pra identificar cifrado)
- [ ] **2.4.6** — Mascaramento nas respostas: `GET /purchase-platforms` devolve `secret: '••••' + last4`, idem `/admin/email-config`
- [ ] **2.4.7** — Documentar processo de rotação de chave em [`docs/secrets.md`](come-pouco-backend/docs/)

---

#### Task 2.5 — Audit log (tabela dedicada)

- **Objetivo**: criar trilha de auditoria de eventos sensíveis. Permite investigar tentativas de invasão, mudanças não autorizadas e fornece base para compliance futuro.
- **Critério de aceite**:
  - Modelo `AuditLog` em Prisma: `id`, `userId?`, `eventType`, `entityType?`, `entityId?`, `ip`, `userAgent`, `metadata Json?`, `success Boolean`, `createdAt`
  - Service `audit.service.ts` com função `logEvent({ eventType, ... })` que persiste fire-and-forget (não bloqueia a request)
  - Eventos cobertos: `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAIL`, `AUTH_LOGIN_2FA_SUCCESS`, `AUTH_LOGIN_2FA_FAIL`, `AUTH_PASSWORD_RESET`, `AUTH_2FA_SETUP`, `AUTH_2FA_DISABLE`, `AUTH_TRUSTED_DEVICE_REVOKE`, `ADMIN_USER_CREATE/UPDATE/DELETE`, `ADMIN_COMPANY_CREATE/UPDATE/DELETE`, `ADMIN_PLATFORM_CREATE/UPDATE/DELETE`, `ADMIN_EMAIL_CONFIG_UPDATE`, `ADMIN_RESET_2FA`
  - Endpoint `GET /api/admin/audit-logs` paginado, com filtros por `eventType`, `userId`, `dateRange`
  - Página `/admin/audit` no frontend (timeline simples) — opcional nesta fase
- **Dependências**: nenhuma
- **Notas técnicas**: gravação assíncrona com `.catch(() => {})` — falha de auditoria não pode quebrar o fluxo principal. `metadata` JSON guarda contexto extra (ex.: payload sanitizado). Retenção tratada na Task 2.7.

**Subtasks**:
- [ ] **2.5.1** — Adicionar modelo `AuditLog` em `schema.prisma` + migration
- [ ] **2.5.2** — Criar `audit.service.ts` com `logEvent` (fire-and-forget, captura IP+UA do `req`)
- [ ] **2.5.3** — Definir constants/enums `AuditEventType` em `constants/audit-events.ts`
- [ ] **2.5.4** — Instrumentar auth: login OK/fail, 2FA OK/fail, password reset, 2FA setup/disable, trusted device revoke
- [ ] **2.5.5** — Instrumentar controllers admin: create/update/delete em User, Company, PurchasePlatform, EmailConfig, reset-2FA
- [ ] **2.5.6** — Criar endpoint `GET /admin/audit-logs` com paginação + filtros
- [ ] **2.5.7** — (Opcional, baixa prioridade) Página `/admin/audit` no frontend
- [ ] **2.5.8** — Testar que falha de audit não derruba operação principal (mock erro de DB no audit)

---

#### Task 2.6 — Paginação, índices e otimização de queries

- **Objetivo**: tornar a API previsivelmente rápida mesmo com volume. Paginar todas as listas, adicionar índices faltantes, cachear lookup de user no auth middleware, dar timeout em chamadas externas.
- **Critério de aceite**:
  - Helper `paginate({ page, limit, maxLimit })` retornando `{ data, meta: { page, limit, total, totalPages } }`
  - Endpoints paginados: `/affiliate-links`, `/users`, `/companies`, `/purchase-platforms`, `/admin/api-usage`, `/admin/audit-logs`
  - Frontend ajustado pra navegar pelas páginas (server-side pagination em `MatPaginator`)
  - Índices novos: `users(company_id)`, `purchase_platforms(type, is_active)`, `audit_logs(user_id, created_at)`, `audit_logs(event_type, created_at)`
  - Cache em memória do `user` no `authMiddleware` com TTL 30s + invalidação on password change (Task 2.3)
  - `fetch` Shopee com `AbortSignal.timeout(10_000)`
  - Prisma com `log: ['warn', 'error']` em prod e `['query', 'warn', 'error']` em dev com threshold de query lenta
- **Dependências**: nenhuma (mas casa bem com Task 2.5 — paginação já entra com audit log)
- **Notas técnicas**: paginação page-based é mais simples e o Material `MatPaginator` já é page-based. Cache em memória usa `Map<userId, { user, expiresAt }>`; cuidado se for cluster futuro (in-memory não compartilha — virar Redis na próxima fase, se necessário).

**Subtasks**:
- [ ] **2.6.1** — Criar `utils/pagination.ts` (parser de query, builder do meta, validação de limites)
- [ ] **2.6.2** — Definir defaults globais: `page=1`, `limit=20`, `maxLimit=100`
- [ ] **2.6.3** — Aplicar paginação em todos os endpoints de lista (services + controllers)
- [ ] **2.6.4** — Adaptar frontend: services Angular passam `page` e `limit`, `MatPaginator` em todas as listas
- [ ] **2.6.5** — Migration: adicionar índices `users(company_id)`, `purchase_platforms(type, is_active)`, e os de `audit_logs` (após Task 2.5)
- [ ] **2.6.6** — Implementar cache curto de user no `authMiddleware` (TTL 30s, invalidação por `passwordChangedAt`)
- [ ] **2.6.7** — Adicionar `AbortSignal.timeout(10_000)` em `shopee-affiliate-client.service.ts`
- [ ] **2.6.8** — Configurar `log` do Prisma client (`prisma.ts`) com threshold de query lenta logada em warn
- [ ] **2.6.9** — Benchmark rápido: rodar `seed` com 10k links e medir `GET /affiliate-links?page=1&limit=20` antes e depois dos índices

---

#### Task 2.7 — Retenção e gestão de tabelas que crescem

- **Objetivo**: garantir que `ApiRequestLog` e `AuditLog` não cresçam sem limite. Estender o job atual (que só limpa `affiliate_links`) pra cobrir as duas novas tabelas com retenção apropriada.
- **Critério de aceite**:
  - `ApiRequestLog` tem retenção configurável (env `API_REQUEST_LOG_RETENTION_DAYS`, default 90)
  - `AuditLog` tem retenção configurável (env `AUDIT_LOG_RETENTION_DAYS`, default 365)
  - Job de cleanup no mesmo cron das 03:00 limpa as três tabelas em sequência, com logs claros de quantos registros removidos
  - Métricas básicas: log de tamanho aproximado de cada tabela após cleanup
- **Dependências**: Task 2.5 (precisa do `AuditLog` existir)
- **Notas técnicas**: usar `DELETE ... USING` em SQL bruto via Prisma (como já é feito em `history-cleanup.job.ts`) é eficiente. Atenção: em volumes altos, `DELETE` grande pode lockar a tabela — considerar batched delete (limit + loop). Por enquanto, simples basta.

**Subtasks**:
- [ ] **2.7.1** — Adicionar envs `API_REQUEST_LOG_RETENTION_DAYS` e `AUDIT_LOG_RETENTION_DAYS` em `config/env.ts` e `.env.example`
- [ ] **2.7.2** — Estender `history-cleanup.job.ts` (ou criar `data-retention.job.ts`) cobrindo as três tabelas
- [ ] **2.7.3** — Adicionar log informativo de contagem por tabela antes/depois
- [ ] **2.7.4** — Documentar política de retenção em `docs/data-retention.md`

---

<!-- Fase 3 — A ser definida -->

