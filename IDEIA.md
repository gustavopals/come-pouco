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

### Fase 3 — Módulo Público "Alli" (Conversor de Links Shopee)

**Objetivo da fase**: criar um produto público **sem login**, focado em conversão para tráfego social (Instagram/TikTok/Telegram). Cada Company ganha uma landing page (`/p/<companySlug>`) onde seus seguidores colam **qualquer URL Shopee** (longa ou `shope.ee/...`) e recebem em segundos a mesma URL com o link de afiliado da empresa aplicado. Mobile-first, instantâneo, com fallback robusto e telemetria pra entender o que converte. Reaproveita toda a integração Shopee já existente (`shopee-integration.service`) e o modelo multi-tenant — nada de duplicar credenciais ou lógica de assinatura.

**Critério de "pronta"**:
- URL pública `/p/<companySlug>[/<employeeSlug>]` carrega landing customizada da empresa em < 1.5s no 4G mobile (Lighthouse perf ≥ 90)
- Usuário cola URL Shopee → vê loading "Buscando melhores cupons…" → em < 3s é redirecionado automaticamente pra Shopee com link de afiliado correto
- Backend resolve `shope.ee/...` (shortlink) → URL longa, extrai `itemId`/`shopId`, chama Shopee Affiliate API, devolve URL com `sub_id` correto
- Cache em memória (`lru-cache`) de URLs já resolvidas (TTL 30min) evita gastar quota Shopee em links repetidos
- **Fallback robusto**: se Shopee API falhar ou retornar vazio, redireciona pro link genérico de afiliado da empresa (`Company.fallbackAffiliateUrl`) — usuário **nunca** vê erro técnico, sempre cai em algo monetizável
- Cada conversão (sucesso, fallback ou erro) grava em `Conversion` pra analytics
- Rate limit estrito por IP (30/min) + honeypot + hash de IP (LGPD)
- Dashboard owner/admin mostra: top produtos, conversões/dia, taxa de sucesso, taxa de fallback, employees com mais conversões
- Documentação `docs/public-module.md` explicando onboarding de empresa nova

**Decisões macro tomadas** (alinhadas com usuário):
- **URL strategy**: `/p/<companySlug>[/<employeeSlug>]` dentro do mesmo Angular app, lazy-loaded, **sem `AuthInterceptor`**. Custom domain por empresa fica pra fase futura.
- **Tracking (sub_id)**: dois níveis — slug de empresa (obrigatório) + slug de employee (opcional). Mapeamento Shopee: `sub_id1 = company.slug`, `sub_id2 = employee.slug || 'direct'`, `sub_id3 = conversion.id` (rastreabilidade ponta-a-ponta).
- **UX final**: redirect automático em 2-3s com tela "Aplicando cupom…", **com botão visível** como fallback se o redirect for bloqueado.
- **Cache**: `lru-cache` em memória (sem Redis nesta fase — casa com Fase 2). TTL 30min para conversões; 7 dias para shortlinks expandidos (raramente mudam).
- **Captcha**: NÃO usar (atrito alto demais). Proteção via rate limit + honeypot + análise simples de padrões.
- **Privacidade**: IP armazenado como hash HMAC-SHA256 com salt em env (`PUBLIC_IP_HASH_SALT`).

**Não-escopo desta fase** (explicitamente adiado):
- Custom domain por empresa (TLS automático, validação DNS)
- SSR / SSG para SEO avançado (landing é destino de social, não busca)
- A/B test framework
- Captcha / reCAPTCHA
- Edição visual rica do conteúdo da landing (apenas campos texto/cor por enquanto)

---

#### Task 3.1 — Modelagem de dados e migrations

- **Objetivo**: criar as estruturas de dados que sustentam o módulo público — slugs únicos, configuração de landing por empresa, registro de cada conversão. Sem isso, nada do resto encaixa.
- **Critério de aceite**:
  - `Company` ganha colunas `publicSlug String? @unique`, `fallbackAffiliateUrl String?`
  - `User` ganha coluna `publicSlug String?` (único por `companyId`, não global)
  - Novo modelo `LandingConfig` com 1-para-1 com `Company`: `bannerText`, `bannerEmoji`, `heroTitle`, `heroSubtitle`, `howItWorksSteps Json`, `primaryColor`, `logoUrl`, `isActive Boolean`, `createdAt`, `updatedAt`
  - Novo modelo `Conversion`: `id`, `companyId`, `employeeId?`, `originalUrl`, `normalizedUrl?`, `affiliateUrl?`, `itemId?`, `shopId?`, `status` (`SUCCESS|FALLBACK|ERROR`), `errorReason?`, `mode` (`MOCK|REAL`), `ipHash`, `userAgent`, `referrer?`, `responseTimeMs Int`, `createdAt`
  - Índices criados: `conversions(companyId, createdAt DESC)`, `conversions(employeeId, createdAt DESC)`, `conversions(itemId)`, `conversions(status, createdAt DESC)`
  - Migration roda em DB seed sem perda de dados existentes
- **Dependências**: nenhuma
- **Notas técnicas**: `publicSlug` da empresa deve ser slugificado (kebab-case, sem acentos) e validado contra reservados (`admin`, `login`, `api`, `health`, `assets`). Considerar coluna `publicSlug` com `@unique` parcial (apenas quando `NOT NULL`) — Prisma não tem suporte direto, alternativa é tratar uniqueness no service. Para `User.publicSlug` é único **por empresa** (composto), evita conflito entre empresas. `ipHash` é `String @db.VarChar(64)` (hex SHA-256).

**Subtasks**:
- [ ] **3.1.1** — Adicionar `publicSlug` e `fallbackAffiliateUrl` em `Company` no `schema.prisma` + validação no service
- [ ] **3.1.2** — Adicionar `publicSlug` em `User` com unique composto `(companyId, publicSlug)`
- [ ] **3.1.3** — Criar modelo `LandingConfig` (1:1 com `Company`) + relação reversa
- [ ] **3.1.4** — Criar modelo `Conversion` com todos os campos + índices
- [ ] **3.1.5** — Definir enums `ConversionStatus` e `ConversionMode` (`MOCK|REAL`)
- [ ] **3.1.6** — Gerar migration `npx prisma migrate dev --name add-public-module`
- [ ] **3.1.7** — Documentar lista de slugs reservados em `config/reserved-slugs.ts`
- [ ] **3.1.8** — Atualizar `prisma/seed.ts` (se existir) para criar `LandingConfig` default ao criar Company

---

#### Task 3.2 — Serviço de validação e normalização de URL Shopee

- **Objetivo**: isolar o parsing de URLs Shopee num serviço puro, sem efeitos colaterais — recebe string, devolve `{ valid, kind, originalUrl, itemId?, shopId? }`. Suporta os três formatos principais: link longo (`shopee.com.br/...`), shortlink (`shope.ee/...`) e link já com afiliado (detectar e tratar).
- **Critério de aceite**:
  - Função `parseShopeeUrl(input: string): ShopeeUrlAnalysis` que reconhece:
    - `https://shopee.com.br/product/{shopId}/{itemId}` (formato canônico)
    - `https://shopee.com.br/{slug}-i.{shopId}.{itemId}` (formato slug-i)
    - `https://shope.ee/{code}` (shortlink — marca como `kind: 'short'`)
    - `https://s.shopee.com.br/{code}` (shortlink alternativo)
    - Outras URLs Shopee não-produto (categoria, busca, perfil) — marca `kind: 'non-product'` e passa pro fluxo mesmo assim (fallback)
  - Validação rejeita: URLs malformadas, domínios não-Shopee, esquemas não-HTTP(S)
  - Retorna estrutura tipada exportada em `types/shopee-url.ts`
  - 100% de cobertura de teste unitário com casos reais coletados (mín. 20 casos)
- **Dependências**: nenhuma
- **Notas técnicas**: usar `URL` do Node nativo + regex bem comentadas e nomeadas. Centralizar em `src/services/shopee-url-parser.service.ts` (sem dependência de Prisma). Coletar exemplos reais de URLs Shopee antes (incluir variações com query params, anchors, mobile URLs `m.shopee.com.br`).

**Subtasks**:
- [ ] **3.2.1** — Coletar 20+ exemplos reais de URLs Shopee (longa, shortlink, com query, mobile, categoria) em `tests/fixtures/shopee-urls.json`
- [ ] **3.2.2** — Criar `shopee-url-parser.service.ts` com `parseShopeeUrl` puro
- [ ] **3.2.3** — Criar regex isoladas e nomeadas (`SHOPEE_PRODUCT_REGEX_CANONICAL`, `SHOPEE_PRODUCT_REGEX_SLUG_I`, etc.) com comentários explicando cada uma
- [ ] **3.2.4** — Definir tipo `ShopeeUrlAnalysis` em `types/shopee-url.ts`
- [ ] **3.2.5** — Tratar URLs com `?` (sub_id já presente, tracking parameters) — normalizar removendo afiliados de outros
- [ ] **3.2.6** — Escrever testes unitários cobrindo todos os fixtures + casos inválidos (Vitest)

---

#### Task 3.3 — Expansão de shortlinks (`shope.ee` → URL longa)

- **Objetivo**: dado um shortlink Shopee, descobrir a URL completa pra qual ele redireciona. É a operação mais sensível do módulo (chama internet, pode travar, pode ser bloqueada).
- **Critério de aceite**:
  - Função `expandShortlink(url: string): Promise<{ finalUrl: string; hops: number }>` em `src/services/shortlink-expander.service.ts`
  - Usa `fetch` com `redirect: 'manual'` e segue redirects em loop (máximo 5 hops)
  - User-Agent realista (mobile Chrome) configurado
  - Timeout total de 5s (`AbortSignal.timeout`)
  - Tenta `HEAD` primeiro; se Shopee retornar 405 ou similar, faz `GET` (sem ler body — `abort` após receber headers)
  - Cache de resultados via cache central da Task 3.4, TTL **7 dias** (shortlinks raramente mudam destino)
  - Erros tratados: timeout → `SHORTLINK_TIMEOUT`, loop infinito → `SHORTLINK_LOOP`, 4xx/5xx final → `SHORTLINK_UNREACHABLE`
  - Logs estruturados com `requestId` (vem da Fase 2.1)
- **Dependências**: Task 3.4 (cache); idealmente Fase 2.1 (request-id e timeout pattern)
- **Notas técnicas**: Shopee às vezes bloqueia user agents óbvios de bot. Testar empiricamente — começar com `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15...`. Considerar pool de UAs no futuro se bloqueio aparecer. Não logar URL com query params em texto puro se contiver sub_id de terceiros (sanitizar).

**Subtasks**:
- [ ] **3.3.1** — Criar `shortlink-expander.service.ts` com `expandShortlink` baseado em `fetch` nativo
- [ ] **3.3.2** — Loop manual de redirects com contador de hops + abort em 5 hops
- [ ] **3.3.3** — Timeout via `AbortSignal.timeout(5_000)` configurável por env (`SHORTLINK_TIMEOUT_MS`)
- [ ] **3.3.4** — Lógica `HEAD → fallback GET` quando Shopee não suportar HEAD
- [ ] **3.3.5** — Integrar com cache (`cache.getOrSet('shortlink:' + url, fn, 7*24*60*60)`)
- [ ] **3.3.6** — Tratar erros com códigos próprios (`SHORTLINK_TIMEOUT`, `SHORTLINK_LOOP`, `SHORTLINK_UNREACHABLE`)
- [ ] **3.3.7** — Testes de integração com URLs Shopee reais (skip em CI por padrão, rodar manual)

---

#### Task 3.4 — Cache em memória com `lru-cache`

- **Objetivo**: criar um cache central reutilizável para shortlinks expandidos e URLs convertidas. Single-flight (evita 2 requests simultâneos pra mesma URL chamarem Shopee duas vezes). Em-memória apenas — alinhado com decisão da Fase 2 de não introduzir Redis.
- **Critério de aceite**:
  - `src/utils/cache.ts` expõe `Cache` com métodos `get`, `set`, `delete`, `getOrSet(key, fn, ttlSec)`
  - Implementação baseada em `lru-cache` v11 com `maxSize` e `ttl` por entrada
  - Suporte a single-flight via `Map<key, Promise>` interno — dois `getOrSet` concorrentes na mesma key compartilham a mesma promise
  - Métricas expostas: `hits`, `misses`, `size` (endpoint `/api/admin/cache-stats` admin-only)
  - Configurável por env: `PUBLIC_CACHE_MAX_ENTRIES` (default 10_000), `PUBLIC_CACHE_DEFAULT_TTL_SEC` (default 1800)
- **Dependências**: nenhuma
- **Notas técnicas**: cuidado com vazamento de memória se cache crescer demais — `lru-cache` resolve via LRU eviction. Em deploy com várias instâncias atrás de load balancer, o cache é por-instância (não compartilha) — aceitável nesta fase. Anotar em `CLAUDE.md` que migrar pra Redis é trivial (mesma interface).

**Subtasks**:
- [ ] **3.4.1** — Instalar `lru-cache@^11` no backend
- [ ] **3.4.2** — Criar `src/utils/cache.ts` com classe `Cache` + interface tipada
- [ ] **3.4.3** — Implementar `getOrSet` com single-flight (Map interno de promises pendentes)
- [ ] **3.4.4** — Contadores de `hits`/`misses` + endpoint `/api/admin/cache-stats` protegido
- [ ] **3.4.5** — Instância singleton `publicCache` exportada de `src/cache/public.cache.ts`
- [ ] **3.4.6** — Adicionar envs em `config/env.ts` e `.env.example`

---

#### Task 3.5 — Serviço de conversão pública (orquestrador)

- **Objetivo**: orquestrar o fluxo completo de conversão pública: validar → expandir → chamar Shopee → cachear → registrar → fallback. Reusa `shopee-integration.service` existente em vez de duplicar a lógica de assinatura GraphQL.
- **Critério de aceite**:
  - `src/services/public-conversion.service.ts` expõe `convertPublicUrl({ url, companySlug, employeeSlug?, ipHash, userAgent, referrer? }): Promise<ConversionResult>`
  - Fluxo:
    1. Resolve `companySlug` → `Company` (404 se não existir ou `LandingConfig.isActive = false`)
    2. Resolve `employeeSlug` opcional → `User` da empresa (warn-log se inválido, segue como `direct`)
    3. Parse via `shopee-url-parser` (Task 3.2)
    4. Se shortlink, expande via `shortlink-expander` (Task 3.3)
    5. Verifica cache `(companyId, normalizedUrl)` — hit retorna direto
    6. Constrói `sub_id1/2/3` (Decisões Macro) e chama `shopee-integration.service.generateShortlink(...)`
    7. Persiste `Conversion` (fire-and-forget, não bloqueia resposta)
    8. Erro Shopee → retorna URL de fallback (`Company.fallbackAffiliateUrl`) e persiste `status: FALLBACK`
  - Tempo total p95 ≤ 2.5s no fluxo "URL longa, cache hit"; ≤ 4s no "shortlink + cache miss"
  - Mode `MOCK` é respeitado (mesma flag de `PurchasePlatform.mockMode`)
- **Dependências**: Tasks 3.1, 3.2, 3.3, 3.4
- **Notas técnicas**: importante reaproveitar `shopee-integration.service` em vez de criar caminho paralelo — assim qualquer melhoria/bug-fix no Shopee client beneficia ambos os fluxos (autenticado e público). A diferença é apenas no monitoramento (`ConversionMode` ao invés de `ApiRequestLog`) e no source dos `sub_id`. Considerar: marcar `Conversion.id` antes do `await` Shopee para usar no `sub_id3`.

**Subtasks**:
- [ ] **3.5.1** — Criar `public-conversion.service.ts` com a função `convertPublicUrl`
- [ ] **3.5.2** — Implementar resolução de `companySlug` + `LandingConfig.isActive` (404 se off)
- [ ] **3.5.3** — Implementar resolução opcional de `employeeSlug` (case-insensitive, escopado por empresa)
- [ ] **3.5.4** — Wire-up: validate → expand (se shortlink) → cache lookup → Shopee call → persist
- [ ] **3.5.5** — Construir `sub_id1/2/3` conforme decisão macro
- [ ] **3.5.6** — Implementar fallback para `Company.fallbackAffiliateUrl` em erro/timeout
- [ ] **3.5.7** — Persistência de `Conversion` fire-and-forget (`.catch(err => logger.error(...))`)
- [ ] **3.5.8** — Testes de integração com `shopee.mockMode = true` cobrindo: sucesso, fallback, employee inválido, shortlink expansion

---

#### Task 3.6 — Endpoints públicos (`/api/public/*`)

- **Objetivo**: expor o módulo Alli via 3 endpoints REST públicos, sem `authMiddleware`, mas com proteções específicas do módulo.
- **Critério de aceite**:
  - Router `src/routes/public.routes.ts` montado em `/api/public` antes do `authMiddleware` global
  - `GET /api/public/landing/:slug` → devolve `LandingConfig` + `Company` (apenas campos seguros: `name`, `publicSlug`, `landingConfig`). Cache HTTP `Cache-Control: public, max-age=300`. 404 se slug inexistente ou `isActive=false`. **Não expõe `fallbackAffiliateUrl` aqui**.
  - `POST /api/public/convert` → recebe `{ url, companySlug, employeeSlug?, honeypot? }`. Devolve `{ status, affiliateUrl, conversionId }` ou `{ status: 'error', errorCode }`. **Nunca expõe stack traces nem detalhes internos.**
  - `GET /api/public/healthz` → liveness probe pública (200 sempre, sem DB hit)
  - Validação via zod (Fase 2.2) — schema em `src/schemas/public.schema.ts`
  - CORS configurado para aceitar requests do próprio domínio + opcionalmente domínios extras (env `PUBLIC_CORS_ORIGINS`)
- **Dependências**: Tasks 3.5; idealmente Fase 2.2 (zod) + Fase 2.1 (rate limit) — se Fase 2 ainda não rodou, criar zod local mínimo
- **Notas técnicas**: importante registrar `/api/public` em `routes/index.ts` **antes** do `app.use(authMiddleware)` global das outras rotas — caso contrário, JWT ausente derruba o request. Honeypot é um campo escondido no form (`website`, `email_alt`) que se preenchido marca a request como bot e devolve sucesso fake (não chama Shopee, salva `status: BOT_DETECTED` no log).

**Subtasks**:
- [ ] **3.6.1** — Criar `src/routes/public.routes.ts` + `src/controllers/public.controller.ts`
- [ ] **3.6.2** — Schemas zod em `src/schemas/public.schema.ts` (URL, slugs, honeypot)
- [ ] **3.6.3** — Endpoint `GET /landing/:slug` com cache HTTP de 5 min
- [ ] **3.6.4** — Endpoint `POST /convert` integrando `public-conversion.service`
- [ ] **3.6.5** — Endpoint `GET /healthz`
- [ ] **3.6.6** — Configurar CORS específico do módulo público (mais permissivo que o resto da API)
- [ ] **3.6.7** — Garantir montagem antes do `authMiddleware` global em `routes/index.ts`
- [ ] **3.6.8** — Honeypot: aceitar campo `website` (vazio esperado); se preenchido, salvar `Conversion(status='BOT_DETECTED')` e devolver sucesso fake
- [ ] **3.6.9** — Smoke test: curl + verificar resposta sem `Authorization` header

---

#### Task 3.7 — Rate limit + segurança do módulo público

- **Objetivo**: proteger o endpoint de conversão contra abuso sem prejudicar UX legítima. Combina rate limit por IP, honeypot (Task 3.6) e hash de IP (LGPD).
- **Critério de aceite**:
  - Rate limit em `/api/public/convert`: 30 req/min por IP, 200 req/dia por IP (janela rolling)
  - Rate limit em `/api/public/landing/:slug`: 60 req/min por IP (mais leve, é GET cacheado)
  - Headers padronizados: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
  - Hash de IP via HMAC-SHA256 com salt em env `PUBLIC_IP_HASH_SALT` (boot falha em prod se vazio)
  - Sanitização de User-Agent: limita a 256 chars, remove caracteres de controle
  - Log de rate-limit hit em `audit_logs` (se Fase 2.5 já existir) ou em `console.warn` estruturado
- **Dependências**: Task 3.6; ideal Fase 2.1 (express-rate-limit) + Fase 2.5 (audit log)
- **Notas técnicas**: cuidado com `trust proxy` para que o IP seja o real (vem do Coolify). Considerar IPv6 — usar `/64` em vez de `/128` para rate limit (caso contrário, abusers IPv6 contornam trocando o último segmento). `express-rate-limit` aceita `keyGenerator` customizado pra isso.

**Subtasks**:
- [ ] **3.7.1** — Criar `src/middlewares/public-rate-limit.middleware.ts` reusando factory da Fase 2.1
- [ ] **3.7.2** — Configurar key generator com IPv6 /64 mask
- [ ] **3.7.3** — Aplicar nos endpoints `/convert` e `/landing/:slug`
- [ ] **3.7.4** — Criar `src/utils/ip-hash.ts` com HMAC-SHA256 e salt da env
- [ ] **3.7.5** — Adicionar `PUBLIC_IP_HASH_SALT` em `config/env.ts` (obrigatório em prod, default dev seguro)
- [ ] **3.7.6** — Sanitização de User-Agent + referrer em middleware
- [ ] **3.7.7** — Log estruturado quando rate limit dispara (`audit_logs` se possível)

---

#### Task 3.8 — Painel admin: gestão de LandingConfig e slugs

- **Objetivo**: dar ao OWNER (e ADMIN) controle visual sobre a landing pública da própria empresa. Editar slug, banner, textos, cores e fallback URL. Também gerenciar slugs dos employees.
- **Critério de aceite**:
  - Endpoints autenticados (gated por OWNER/ADMIN):
    - `GET /api/companies/:id/landing-config`
    - `PUT /api/companies/:id/landing-config`
    - `PUT /api/companies/:id/public-slug` (validação de slug único + reservados)
    - `PUT /api/companies/:id/fallback-url`
    - `PUT /api/users/:id/public-slug` (OWNER só pode editar slug de employees da própria empresa)
  - Página `/my-company` ganha aba "Landing Pública" com:
    - Toggle `isActive`
    - Input para `publicSlug` com validação live (debounced, mostra "✓ disponível" / "✗ em uso")
    - Editor de banner (texto + emoji)
    - Editor de "Como funciona" — lista dinâmica de até 4 passos
    - Color picker para `primaryColor`
    - Upload simples de logo (ou URL externa por enquanto)
    - Input de `fallbackAffiliateUrl` com validação Shopee
    - Preview ao vivo da landing (iframe `/p/<slug>?preview=true`)
  - Página `/users` ganha coluna "Slug público" editável inline
- **Dependências**: Task 3.1, Task 3.6
- **Notas técnicas**: o preview em iframe deve passar header/query `preview=true` para o frontend público mostrar um banner "modo preview". Upload de logo pode começar simples (URL externa); upload binário fica pra fase futura (precisa S3/MinIO). Validação de slug case-insensitive, kebab-case forçado server-side.

**Subtasks**:
- [ ] **3.8.1** — Criar `landing-config.service.ts` + controller + 4 endpoints listados
- [ ] **3.8.2** — Service de validação de slug: kebab-case, length 3-32, lista de reservados
- [ ] **3.8.3** — Service Angular `LandingConfigService` no front
- [ ] **3.8.4** — Aba "Landing Pública" em `my-company.component` com formulário reativo
- [ ] **3.8.5** — Validação live de slug (debounced 300ms + chamada `HEAD /api/public/landing/:slug`)
- [ ] **3.8.6** — Editor dinâmico de "Como funciona" (FormArray com 1-4 passos)
- [ ] **3.8.7** — Preview em iframe da landing
- [ ] **3.8.8** — Coluna editável "Slug público" em `/users` (só OWNER da mesma empresa)
- [ ] **3.8.9** — Testes: validação de slug duplicado entre empresas, OWNER não pode editar slug de employee de outra empresa

---

#### Task 3.9 — Frontend público: scaffolding, roteamento e layout

- **Objetivo**: criar a estrutura Angular do módulo público isolada da app autenticada — lazy-loaded, sem `AuthInterceptor`, com layout dedicado (sem sidebar, sem topbar admin).
- **Critério de aceite**:
  - Pasta `src/app/public/` com módulo lazy `public.routes.ts`
  - Rota `app.routes.ts` adicionada: `{ path: 'p/:companySlug', loadChildren: () => import('./public/public.routes') }`
  - Subrota `{ path: ':employeeSlug', component: ... }` para opcionalmente capturar employee
  - `AuthInterceptor` ignora requests para `/api/public/*` (não anexa Authorization header)
  - Layout próprio `PublicLayoutComponent` (sem sidebar) com slots para hero, conteúdo, footer
  - Tema escuro/claro respeitado, mas usa cores customizadas da empresa (`primaryColor` de LandingConfig)
  - Fontes/styles carregados lazily (chunk separado, não infla bundle admin)
  - Build inicial < 100kb gzipped no chunk público
- **Dependências**: Task 3.6; ideal Fase 1 (design system) para reuso de tokens
- **Notas técnicas**: garantir que rotas autenticadas usem prefixo `/app/...` OU manter raiz e só reservar `/p/...` para público — definir cedo. Recomendação: manter como hoje (autenticadas na raiz, públicas em `/p`), incluir `p` na lista de slugs reservados de empresas (Task 3.1.7) — caso contrário um company.slug `p` quebra tudo.

**Subtasks**:
- [ ] **3.9.1** — Criar diretório `src/app/public/` com `public.routes.ts`, `public-layout.component.ts/html/scss`, `services/`, `models/`
- [ ] **3.9.2** — Registrar rota lazy em `app.routes.ts` com `path: 'p/:companySlug'` e subrota `:employeeSlug`
- [ ] **3.9.3** — Atualizar `AuthInterceptor` para skip em `/api/public/*` (não anexar token)
- [ ] **3.9.4** — Criar `PublicLayoutComponent` minimalista (header com logo + footer leve)
- [ ] **3.9.5** — Service `PublicLandingService` para `GET /api/public/landing/:slug` (com cache local de 5min via signal)
- [ ] **3.9.6** — Service `PublicConvertService` para `POST /api/public/convert`
- [ ] **3.9.7** — Resolver de rota: carrega `LandingConfig` antes de renderizar (404 se inexistente)
- [ ] **3.9.8** — Aplicar `primaryColor` da empresa via CSS variable dinamicamente no `PublicLayoutComponent`

---

#### Task 3.10 — Frontend público: tela de conversão (mobile-first)

- **Objetivo**: implementar a landing principal — hero impactante, input inteligente, CTA, "Como funciona". Otimizada para conversão em dispositivo móvel.
- **Critério de aceite**:
  - Componente `PublicHomeComponent` carregado em `/p/:companySlug`
  - Layout responsivo, mobile-first; viewport 375px sem scroll horizontal
  - Hero: banner de urgência configurável + título + subtítulo
  - Input de URL com validação real-time (regex Shopee), label + placeholder + error inline
  - Botão CTA grande, primary color da empresa, com loading state ("Buscando melhores cupons…")
  - Seção "Como funciona" com até 4 passos visualmente (ícones + texto), respondendo aos passos configurados em LandingConfig
  - Honeypot field (`<input name="website" hidden tabindex="-1" autocomplete="off">`)
  - Trap de paste: se usuário cola URL Shopee, valida + auto-foca botão CTA
  - Acessibilidade: labels, aria-live no error, contrast WCAG AA
  - Lighthouse mobile: perf ≥ 90, a11y ≥ 95
- **Dependências**: Task 3.9
- **Notas técnicas**: validação client-side **não** é fonte da verdade — sempre valida no backend. Cliente apenas evita request óbvio. Considerar pre-carregar `/api/public/convert` com `prefetch` de DNS/preconnect para reduzir TTFB do primeiro request. Para detecção de paste, escutar evento `paste` no input.

**Subtasks**:
- [ ] **3.10.1** — Criar `PublicHomeComponent` com template mobile-first
- [ ] **3.10.2** — Implementar input com validação reativa de URL Shopee (regex Task 3.2)
- [ ] **3.10.3** — Seção hero com banner + título + subtítulo bindados ao LandingConfig
- [ ] **3.10.4** — Seção "Como funciona" iterando sobre `howItWorksSteps` (FormArray no admin)
- [ ] **3.10.5** — Honeypot field hidden + nunca submitar se preenchido (client-side fail-fast)
- [ ] **3.10.6** — Loading state inline no CTA com skeleton/spinner do Angular Material
- [ ] **3.10.7** — Listener de evento `paste` para validação imediata
- [ ] **3.10.8** — Testes E2E (Playwright/Cypress) cobrindo: colar URL válida, URL inválida, honeypot acionado
- [ ] **3.10.9** — Auditoria Lighthouse mobile e ajustes de perf (preconnect, lazy imgs)

---

#### Task 3.11 — Frontend público: tela de resultado / redirect

- **Objetivo**: após o backend converter, mostrar "Aplicando cupom…" e redirecionar automaticamente em 2-3s. Botão visível como fallback. Tratar todos os cenários (sucesso, fallback, erro).
- **Critério de aceite**:
  - Componente `PublicResultComponent` (ou estado interno do `PublicHomeComponent`) ativa após resposta da API
  - Estado `loading`: spinner + "Buscando melhores cupons…" (durante request)
  - Estado `success`: tela "✓ Cupom aplicado! Redirecionando…" com countdown 2s → `window.location.href = affiliateUrl`
  - Botão "Ir para Shopee agora" sempre visível durante o countdown (escape hatch)
  - Estado `fallback`: mesma UX que success, mas com microcopy ajustada ("Direcionando você pra Shopee…")
  - Estado `error` (erro inesperado): "Algo deu errado, tente novamente" + botão "Tentar de novo" voltando ao input
  - Captura de eventos: `trackConversionView`, `trackRedirectClick` via service simples (Task 3.13)
  - Acessibilidade: aria-live em "Aplicando cupom" para leitores de tela
- **Dependências**: Tasks 3.6, 3.10
- **Notas técnicas**: `window.location.assign` é melhor que `.href` (mantém history limpo). Considerar `<meta http-equiv="refresh">` como fallback se JS falhar — improvável mas barato. Bloqueadores de pop-up não afetam `window.location` (afeta `window.open`).

**Subtasks**:
- [ ] **3.11.1** — Adicionar estados `loading | success | fallback | error` no componente Home
- [ ] **3.11.2** — Implementar countdown de 2s com `RxJS interval` e cancelable
- [ ] **3.11.3** — Auto-redirect via `window.location.assign(affiliateUrl)`
- [ ] **3.11.4** — Botão "Ir para Shopee agora" sempre clicável durante countdown
- [ ] **3.11.5** — Tela de erro com botão "Tentar de novo" que reseta o form
- [ ] **3.11.6** — Microcopy diferenciada para `success` vs `fallback` (UX é a mesma; texto interno difere)
- [ ] **3.11.7** — `aria-live="polite"` no container de status
- [ ] **3.11.8** — Testes E2E: sucesso (mockado), fallback, erro 500

---

#### Task 3.12 — Analytics e dashboard de conversões

- **Objetivo**: dar ao OWNER/ADMIN visibilidade sobre o que está acontecendo na landing pública. Top produtos, conversões por dia, taxa de sucesso, atribuição por employee.
- **Critério de aceite**:
  - Endpoints autenticados em `dashboard.controller.ts`:
    - `GET /api/dashboard/conversions/summary?range=7d|30d|90d` → totais, taxa de sucesso, taxa de fallback
    - `GET /api/dashboard/conversions/top-products?range=...&limit=10` → top `itemId` por contagem (com nome do produto se disponível)
    - `GET /api/dashboard/conversions/by-employee?range=...` → conversões agregadas por employee
    - `GET /api/dashboard/conversions/timeline?range=...&bucket=day|hour` → série temporal pra gráfico
  - Página `/home` ganha card "Conversões da Landing" se Company tem `LandingConfig.isActive=true`
  - Página dedicada `/conversions` (OWNER+) com:
    - Cards de resumo (total, sucesso %, fallback %, médio diário)
    - Gráfico de linha temporal (chart.js ou ng2-charts)
    - Tabela de top produtos + tabela de top employees
    - Filtro por range (7d, 30d, 90d) + filtro por employee
- **Dependências**: Tasks 3.1, 3.5; idealmente Fase 2.6 (paginação)
- **Notas técnicas**: queries de agregação em `Conversion` precisam dos índices da Task 3.1 funcionando. Considerar uma view materializada futuramente se volume crescer, mas começar com query direta. Top produtos por `itemId` é o mínimo — enriquecer com nome do produto requer chamar Shopee API ou cachear nome no `Conversion` (preferível: salvar `productName` se Shopee retornar).

**Subtasks**:
- [ ] **3.12.1** — Estender `dashboard.service.ts` com queries de agregação de `Conversion`
- [ ] **3.12.2** — Endpoints REST listados acima + zod schemas pra query params
- [ ] **3.12.3** — Salvar `productName` em `Conversion` se Shopee API retornar (alterar Task 3.5 retroativamente se necessário — migration na 3.1)
- [ ] **3.12.4** — Instalar `ng2-charts` + `chart.js` no frontend
- [ ] **3.12.5** — Criar `ConversionsDashboardComponent` em `pages/conversions/`
- [ ] **3.12.6** — Cards de resumo + gráfico de linha + tabelas
- [ ] **3.12.7** — Filtros (range + employee select)
- [ ] **3.12.8** — Card resumo na `home.component` (já tem `production-summary`, adicionar similar)
- [ ] **3.12.9** — Menu lateral ganha entrada "Conversões" visível para OWNER+

---

#### Task 3.13 — Retenção, LGPD e observabilidade

- **Objetivo**: garantir que o módulo público é sustentável a longo prazo — não acumula dados pessoais, tem retenção clara, e exporta métricas/logs estruturados para diagnóstico.
- **Critério de aceite**:
  - Retenção configurável `CONVERSION_RETENTION_DAYS` (default 180 dias)
  - Cleanup job estendido (Fase 2.7) cobrindo `conversions` em adição às outras tabelas
  - Endpoint admin `DELETE /api/admin/conversions/anonymize?olderThan=...` para anonimização sob demanda (zera `ipHash` e `userAgent`)
  - Logs estruturados em todos os pontos do fluxo: `[public-convert]` prefix, JSON com `requestId`, `companySlug`, `employeeSlug`, `status`, `responseTimeMs`
  - Métrica simples expostas em `/api/admin/metrics/public-module`: cache hit ratio, conversions per minute, fallback ratio
  - Documento `docs/lgpd-public-module.md` listando dados coletados, base legal, retenção, direitos do titular
- **Dependências**: Task 3.1, 3.5; idealmente Fase 2.7 (cleanup job estendido)
- **Notas técnicas**: hash de IP já é forma de pseudoanonimização — defender se questionado por usuário. Considerar adicionar consent banner antes da primeira conversão se o usuário estiver na UE/UK (campo `consent_at` em `Conversion`? — adiar pra fase futura, fora do escopo).

**Subtasks**:
- [ ] **3.13.1** — Adicionar `CONVERSION_RETENTION_DAYS` em `config/env.ts` + `.env.example`
- [ ] **3.13.2** — Estender cleanup job (Fase 2.7) ou criar `conversion-retention.job.ts` rodando às 03:30
- [ ] **3.13.3** — Endpoint admin `DELETE /api/admin/conversions/anonymize?olderThan=...`
- [ ] **3.13.4** — Logger estruturado com prefix `[public-convert]` em todo `public-conversion.service`
- [ ] **3.13.5** — Endpoint `GET /api/admin/metrics/public-module` (cache stats, taxas, contagens últimos 24h)
- [ ] **3.13.6** — Documentar LGPD em `docs/lgpd-public-module.md`
- [ ] **3.13.7** — Atualizar `CLAUDE.md` com nova arquitetura do módulo público

---

#### Task 3.14 — Testes E2E, documentação e lançamento

- **Objetivo**: validar o fluxo ponta-a-ponta com testes automatizados, documentar onboarding de empresa nova, fazer dry-run em ambiente de homologação e habilitar pra primeira empresa-piloto.
- **Critério de aceite**:
  - Suíte E2E (Playwright recomendado) cobrindo:
    - URL longa Shopee → conversão sucesso → redirect
    - Shortlink → expansão → conversão sucesso
    - URL inválida → erro inline
    - Honeypot acionado → "sucesso" fake sem chamar Shopee
    - Shopee API down (mock) → fallback URL aplicada
    - Slug inexistente → 404
    - Employee slug inválido → log warn + flui como direct
  - Documento `docs/public-module.md`:
    - Diagrama de arquitetura
    - Como onboarding uma empresa nova (criar slug, configurar landing, definir fallback URL, ativar)
    - Como debugar conversões (audit log, conversion table, request-id)
    - Política de retenção e LGPD
  - Checklist de lançamento (`docs/public-module-launch-checklist.md`):
    - Env vars setadas em prod (`PUBLIC_IP_HASH_SALT`, retention)
    - Migrations aplicadas
    - Empresa piloto criada e validada (1 conversão real ponta-a-ponta)
    - Smoke test pós-deploy verde
- **Dependências**: todas as Tasks 3.1 a 3.13
- **Notas técnicas**: testes E2E rodam em pipeline em backend mockado (`SHOPEE_MOCK=true`). Não rodar contra API real Shopee em CI — ela tem rate limit e custos. Empresa piloto: escolher uma com pouco tráfego pra validar antes de massificar.

**Subtasks**:
- [ ] **3.14.1** — Instalar Playwright no monorepo (pasta `e2e/` na raiz)
- [ ] **3.14.2** — Escrever specs E2E listadas no critério de aceite
- [ ] **3.14.3** — Criar `docs/public-module.md` com diagrama + onboarding + debug
- [ ] **3.14.4** — Criar `docs/public-module-launch-checklist.md`
- [ ] **3.14.5** — Atualizar `IDEIA.md` (esta seção) marcando Subtasks completas e `CLAUDE.md` com endpoints novos
- [ ] **3.14.6** — Smoke test pós-deploy estendido (`smoke:postdeploy`) cobrindo conversão pública mockada
- [ ] **3.14.7** — Dry-run de onboarding com empresa piloto: criar slug, ativar landing, 1 conversão real
- [ ] **3.14.8** — Comunicação interna: changelog + screenshots no canal de produto

---

### Resumo da Fase 3 em uma página

**O que ganha**:
- Produto novo, voltado a end-user (não admin) — abre porta pra crescer base de afiliados
- Cada Company ganha landing page pronta sem precisar codar nada
- Cada Employee/influenciador tem URL própria com atribuição (`/p/empresa/joao`)
- Telemetria forte: top produtos, conversões por canal, taxa de sucesso
- Reaproveita 100% da integração Shopee existente — zero duplicação

**O que não ganha (adiado por escopo)**:
- Custom domain por empresa (TLS automático)
- SSR / SEO avançado (landing é destino social, não orgânico)
- Captcha / 3rd-party anti-bot
- Upload binário de logo (URL externa por enquanto)
- A/B testing framework
- Cache distribuído / Redis (continua in-memory)

**Stack adicionada**: `lru-cache@^11`, `chart.js` + `ng2-charts`, Playwright pra E2E. Nada disso é pesado.

**Riscos identificados**:
- Shopee pode bloquear bot/user-agent inválido na expansão de shortlinks → mitigação: UA realista + monitorar logs
- Cache em-memória não compartilha entre instâncias → aceitável pra single-instance Coolify atual, migração pra Redis trivial
- Volume da tabela `conversions` cresce rápido se vazar pra spam → retenção 180d + rate limit + honeypot
- LGPD: hash de IP cobre, mas se um produto X virar viral, queries de agregação podem ficar lentas → índices da Task 3.1 + considerar view materializada em fase futura

**Ordem de execução recomendada**:
1. Task 3.1 (modelagem) — fundação, não tem como pular
2. Tasks 3.2 + 3.3 + 3.4 — peças backend independentes, podem ser feitas em paralelo
3. Task 3.5 + 3.6 + 3.7 — orquestrador + endpoints + segurança em sequência
4. Tasks 3.9, 3.10, 3.11 — frontend público (depois que endpoints existem)
5. Task 3.8 — painel admin de configuração (pode rodar em paralelo com 3.9-3.11)
6. Task 3.12 — analytics (depende de ter conversões reais)
7. Tasks 3.13 + 3.14 — retenção/observabilidade + testes + lançamento

---

### Fase 4 — Landing Page Institucional (Marketing Site)

> **🎯 Esta fase deve ser executada com Claude Opus 4.7 + skill de frontend design.** A entrega é visual antes de tudo — copywriting, hierarquia, micro-animações, polimento — e exige o modelo mais capaz combinado com a habilidade especializada em design para sair com qualidade de referência (Linear, Vercel, Stripe, Notion).

**Objetivo da fase**: criar um **site institucional/marketing** novo no monorepo, separado da aplicação autenticada, com missão única: **converter visitante em lead/cliente**. Apresenta a proposta de valor da Come Pouco (gestão profissional de afiliados Shopee + módulo público Alli + multi-tenant), constrói confiança e captura interesse via formulário ou planos. Visual moderno, mobile-first, performance impecável (Lighthouse 100/100 como meta), SEO bem feito desde o dia 1.

**Critério de "pronta"**:
- Novo projeto `come-pouco-landing/` rodando em Astro + Tailwind v4, com `npm run dev:landing` no root
- Domínio próprio servindo a landing (`come-pouco.com.br` raiz; app continua em `app.come-pouco.com.br`)
- Todas as seções implementadas e revisadas: Hero, Trust strip, Features, Showcase Alli, Como funciona, Segurança, Pricing (3 tiers), FAQ, CTA final, Footer
- Captura de lead funcional integrada com `SystemEmailConfig` existente (reusa transporter já configurado)
- SEO: sitemap.xml, robots.txt, meta tags por página, schema.org `Organization`/`Product`/`FAQPage`, Open Graph com imagem dinâmica
- Dark mode com persistência + respeito a `prefers-color-scheme`
- Lighthouse: Performance ≥ 95, A11y ≥ 95, Best Practices ≥ 95, SEO = 100 (mobile e desktop)
- Tamanho de JS enviado ao cliente < 30kb gzipped (Astro shipping zero JS por padrão, ilhas mínimas)
- Auditoria WCAG AA com axe-core: 0 violações
- Analytics privacy-first ativo (Plausible ou Umami self-hosted)
- Documentação: `come-pouco-landing/README.md` com como rodar, criar nova seção, editar conteúdo

**Stack escolhida**: Astro 5 + Tailwind v4 + Lucide icons + Motion One (animações leves) + MDX (para blog futuro) + Resend (envio do form de lead) + Plausible/Umami (analytics privacy-first).

**Decisões macro tomadas** (alinhadas com usuário):
- **Stack**: Astro + Tailwind v4 (HTML estático, zero-JS por padrão, ilhas onde precisa)
- **Idioma**: PT-BR apenas no lançamento. Estrutura preparada pra i18n futuro, mas sem rotas `/pt` `/en` por enquanto.
- **Pricing**: 3 tiers públicos (**Free / Pro / Enterprise**) com preço visível em Free e Pro; Enterprise "Fale conosco".
- **Domínio**: landing em `come-pouco.com.br` (raiz); app autenticada em `app.come-pouco.com.br`. Módulo Alli (Fase 3) continua em `app.come-pouco.com.br/p/<slug>`.
- **Identidade visual**: reusa tokens da Fase 1 (paleta, tipografia Manrope, raios, sombras) mas com **aesthetic de marketing** (mais respiro, mais hero visual, mais movimento sutil) — versão "marketing" do design system, não cópia do app.
- **Captura de lead**: integra com `SystemEmailConfig` da app existente via endpoint compartilhado no backend (`POST /api/public/leads`). Sem provider externo (Formspree, HubSpot) por enquanto.

**Não-escopo desta fase** (explicitamente adiado):
- Blog (estrutura MDX pronta, mas sem posts iniciais — fase futura)
- Casos de uso reais / depoimentos com fotos (usa placeholders ou logos genéricos por enquanto)
- A/B testing framework
- CMS (Sanity, Strapi) — conteúdo vive em `.mdx` no repo, edição via PR
- Live chat (Intercom, Crisp)
- Páginas legais completas (Política de Privacidade e Termos: páginas placeholder linkadas no footer; revisão jurídica fica fora desta fase)
- Versão inglês

**Princípios de design da landing** (referências e racional):
- **Linear** — clareza brutal, tipografia bem trabalhada, dark mode lindo, hero focado
- **Vercel** — gradientes sutis, performance como diferencial visível, Lighthouse score público
- **Stripe** — autoridade técnica, ilustrações conceituais, código no hero
- **Notion** — emocional sem perder utilidade, micro-animações pontuais
- Aplicação: nosso visual = **clareza Linear + sutileza Vercel + autoridade Stripe**, em PT-BR com pegada brasileira (sem ser cafona). Evitar gradiente arco-íris, evitar muita ilustração 3D, evitar copy infantilizada.

---

#### Task 4.1 — Setup do projeto Astro no monorepo

- **Objetivo**: criar `come-pouco-landing/` como terceiro pacote do monorepo (irmão de `come-pouco-backend` e `come-pouco-frontend`), com Astro 5 + Tailwind v4 configurados, tokens da Fase 1 importados, scripts `dev/build` integrados aos do root.
- **Critério de aceite**:
  - Diretório `come-pouco-landing/` criado com `package.json`, `astro.config.mjs`, `tailwind.config.ts`, `tsconfig.json`
  - Scripts no `package.json` root: `dev:landing`, `build:landing`, `install:landing` (este último entra no `postinstall` de root)
  - `npm run dev` (root) ganha opção `dev:all` que sobe backend + frontend + landing em paralelo (concurrently)
  - Tokens da Fase 1 importados como CSS variables compartilhadas (`@cp/tokens` ou simples symlink/copy)
  - Hot reload funcionando, `http://localhost:4321` abre uma página "Em construção" com tipografia Manrope aplicada
  - `npm run build:landing` produz output estático em `come-pouco-landing/dist/`
  - `.gitignore` correto, `tsconfig` paths definidos
- **Dependências**: idealmente Fase 1 Task 1.1 (tokens definidos)
- **Notas técnicas**: Astro 5 traz `astro:env` para vars tipadas, `astro:assets` para image optimization, `@astrojs/sitemap` e `@astrojs/mdx` como integrações oficiais. Tailwind v4 usa `@import "tailwindcss"` direto no CSS (config-less por padrão). Tema dark via `darkMode: 'class'`. Concurrently já está no root (Fase 0).

**Subtasks**:
- [ ] **4.1.1** — `npm create astro@latest come-pouco-landing -- --template minimal --typescript strict --tailwind`
- [ ] **4.1.2** — Configurar Tailwind v4: importar `@cp/tokens.css` (CSS vars da Fase 1), `darkMode: 'class'`, paths corretos
- [ ] **4.1.3** — Adicionar fontes Manrope variable via `@fontsource-variable/manrope` (mesma da Fase 1)
- [ ] **4.1.4** — Configurar `astro.config.mjs`: site URL (`https://come-pouco.com.br`), integrations `@astrojs/sitemap`, `@astrojs/mdx`, `@astrojs/icon` (Lucide via `lucide-astro`)
- [ ] **4.1.5** — Adicionar scripts no `package.json` root: `dev:landing`, `build:landing`, `install:landing` (incluir no `postinstall`)
- [ ] **4.1.6** — Adicionar script `dev:all` rodando backend + frontend + landing com concurrently
- [ ] **4.1.7** — Criar `come-pouco-landing/README.md` com instruções (dev, build, estrutura de pastas)
- [ ] **4.1.8** — Criar `come-pouco-landing/.env.example` com `PUBLIC_SITE_URL`, `PUBLIC_PLAUSIBLE_DOMAIN`, `LEAD_API_URL`

---

#### Task 4.2 — Brand kit e identidade visual da marca

- **Objetivo**: definir o sistema visual **da marca Come Pouco** (não confundir com o design system da aplicação autenticada). Logo, paleta de marketing, ilustrações conceituais, fotografia/mockups, tom de voz.
- **Critério de aceite**:
  - Logo Come Pouco em SVG (versão completa + monograma) — preto, branco, gradient
  - Favicon completo (`favicon.svg`, `apple-touch-icon.png` 180×180, `manifest.json`)
  - Paleta de marketing documentada em `docs/brand.md`: cor primária, secundárias, neutros, semânticos. Pode reusar 100% Fase 1 ou adicionar 1-2 cores específicas de marketing (gradiente do hero)
  - Conjunto de **ilustrações conceituais** definido: 3-5 ilustrações simples e geométricas (estilo abstrato/isométrico leve, não 3D pesado) cobrindo: "afiliados", "automação", "dashboard", "segurança", "público convertendo"
  - Mockups do app: 3 screenshots-chave do admin renderizados em frames (browser frame para desktop, phone frame para mobile)
  - Tom de voz documentado: direto, técnico-acessível, brasileiro sem regionalismos, 2ª pessoa ("você") — exemplos de "como falar" e "como NÃO falar"
- **Dependências**: Task 4.1
- **Notas técnicas**: ilustrações podem vir de bibliotecas open-source (unDraw, Open Peeps, Reshot) **com ajuste de cor** pra paleta — evitar visual genérico. Mockups de produto devem ser **da app real**, não inventados — capturar screenshots de telas finalizadas pós-Fase 1. Frames de mockup: usar componentes Astro simples (CSS puro), não plugin pesado.

**Subtasks**:
- [ ] **4.2.1** — Criar logo Come Pouco em SVG (wordmark + ícone), 3 variações (color, mono dark, mono light)
- [ ] **4.2.2** — Gerar favicons completos (favicon.ico, .svg, apple-touch-icon, manifest)
- [ ] **4.2.3** — Documentar paleta de marketing em `come-pouco-landing/docs/brand.md`
- [ ] **4.2.4** — Selecionar/produzir 3-5 ilustrações conceituais SVG (estilo geométrico leve)
- [ ] **4.2.5** — Capturar 3 screenshots do app pós-Fase 1 (Dashboard, Affiliate Links, Alli admin) e renderizar em browser frame
- [ ] **4.2.6** — Capturar 1 screenshot mobile do módulo Alli público em phone frame
- [ ] **4.2.7** — Documentar tom de voz e copywriting em `come-pouco-landing/docs/voice.md`
- [ ] **4.2.8** — Adicionar todos os assets em `come-pouco-landing/public/` ou `src/assets/` (decidir conforme uso)

---

#### Task 4.3 — Design system de componentes Astro

- **Objetivo**: criar a biblioteca de componentes Astro reutilizáveis que vai compor toda a landing — botões, cards, badges, container, seção, gradient blob, etc. Toda seção da landing consome esses primitivos, garantindo consistência.
- **Critério de aceite**:
  - Pasta `src/components/ui/` com componentes Astro:
    - `Button.astro` (variants: `primary`, `secondary`, `ghost`, `link`; sizes: `sm`, `md`, `lg`)
    - `Badge.astro` (variants: `default`, `success`, `info`, `accent`)
    - `Container.astro` (max-width responsivo, padding lateral)
    - `Section.astro` (wrapper com espaçamento vertical padronizado)
    - `Card.astro` (com sombra/borda, hover state opcional)
    - `GradientBlob.astro` (blob decorativo de fundo, posicionável)
    - `BrowserFrame.astro` (frame com chrome dots + screenshot dentro)
    - `PhoneFrame.astro` (frame mobile estilizado)
    - `IconBox.astro` (ícone Lucide com background colorido — para listas de features)
  - Cada componente tipado (props com TypeScript interface)
  - Storybook **não** será criado nesta fase (overhead alto pra valor baixo no contexto); em vez disso, criar página `/dev/components` que renderiza todos os variants — só em dev
  - Dark mode funcionando em todos os componentes
- **Dependências**: Tasks 4.1, 4.2
- **Notas técnicas**: Astro components são `.astro` (HTML+TS sem runtime React). Para variants, usar `class-variance-authority` ou função simples local. Evitar dependências pesadas — landing deve ser enxuta. Reusar tokens via CSS variables do Tailwind.

**Subtasks**:
- [ ] **4.3.1** — Criar `Container.astro` e `Section.astro` (primitivos de layout)
- [ ] **4.3.2** — Criar `Button.astro` com 4 variants + 3 sizes
- [ ] **4.3.3** — Criar `Badge.astro`, `IconBox.astro`, `Card.astro`
- [ ] **4.3.4** — Criar `BrowserFrame.astro` e `PhoneFrame.astro` com slot para imagem/conteúdo
- [ ] **4.3.5** — Criar `GradientBlob.astro` configurável (posição, cor, blur, opacidade)
- [ ] **4.3.6** — Criar página `/dev/components` listando todos variants (só renderiza em `import.meta.env.DEV`)
- [ ] **4.3.7** — Testar dark mode em todos os componentes manualmente
- [ ] **4.3.8** — Adicionar `lucide-astro` para ícones e documentar quais ícones do set usar

---

#### Task 4.4 — Layout global: Header, Footer, navegação mobile

- **Objetivo**: estruturar a casca da landing — header com logo + nav + CTA + toggle de tema; footer com links, contato, redes sociais, legal. Navegação mobile com drawer/sheet.
- **Critério de aceite**:
  - `src/layouts/BaseLayout.astro` é o layout único usado por todas as páginas, contendo `<head>` SEO completo, `<Header>` e `<Footer>`
  - **Header**:
    - Logo à esquerda (link pra `/`)
    - Nav central com itens: Recursos, Como funciona, Preços, FAQ, Blog (placeholder)
    - À direita: toggle dark mode + botão "Entrar" (link pra `app.come-pouco.com.br/login`) + botão CTA "Começar grátis" (primary, scroll para pricing ou form)
    - Em mobile: hamburger abre drawer com mesmos itens
    - Sticky no scroll com backdrop blur quando saiu do topo
  - **Footer**:
    - Coluna 1: logo + tagline curta + redes sociais (Instagram, LinkedIn, GitHub)
    - Coluna 2: Produto (Recursos, Preços, Alli)
    - Coluna 3: Empresa (Sobre, Blog, Contato)
    - Coluna 4: Legal (Privacidade, Termos, LGPD)
    - Faixa inferior: `© 2026 Come Pouco. Feito no Brasil.`
  - Toggle de tema: 3 estados (`light`, `dark`, `system`), persistido em `localStorage`, FOUC eliminado (script inline antes do `<body>`)
  - Drawer mobile usa `<dialog>` HTML nativo (zero JS) ou ilha Alpine.js mínima
- **Dependências**: Tasks 4.1, 4.3
- **Notas técnicas**: para eliminar FOUC em dark mode com Astro estático, injetar script blocking no `<head>` que lê `localStorage` antes do CSS aplicar. Drawer mobile com `<dialog>` é zero-JS e acessível por padrão. Sticky header com `backdrop-filter: blur` precisa de fallback pra navegadores antigos.

**Subtasks**:
- [ ] **4.4.1** — Criar `BaseLayout.astro` com `<head>` completo (charset, viewport, fonts preload, theme color)
- [ ] **4.4.2** — Implementar script anti-FOUC de dark mode (inline `<head>` antes do CSS)
- [ ] **4.4.3** — Criar `Header.astro` desktop (logo + nav + CTAs)
- [ ] **4.4.4** — Implementar sticky com backdrop blur on scroll (CSS puro com `position: sticky` + IntersectionObserver leve)
- [ ] **4.4.5** — Criar `MobileNav.astro` com `<dialog>` HTML nativo + animação CSS
- [ ] **4.4.6** — Criar `Footer.astro` com 4 colunas + faixa inferior
- [ ] **4.4.7** — Criar `ThemeToggle.astro` (ilha mínima ou inline script) com 3 estados
- [ ] **4.4.8** — Testar nav em viewport 375px (sem scroll horizontal, drawer abre suave)

---

#### Task 4.5 — Hero + Social proof (Trust strip)

- **Objetivo**: a primeira tela é a mais importante — em 5 segundos o visitante precisa entender **o que é**, **para quem é** e **por que é melhor**. Deve provocar emoção (visual) + clareza (copy) + ação (CTA).
- **Critério de aceite**:
  - **Hero**:
    - Eyebrow badge ("✨ Novo: módulo Alli para conversão pública" — link pra seção)
    - H1 grande (52-72px desktop, 36-44px mobile): proposta de valor em 1 frase forte. Sugestão de baseline: "Gere links de afiliado Shopee no automático e venda mais com sua audiência"
    - Subhead (1-2 linhas): explica o que diferencia
    - Dois CTAs: primary "Começar grátis" + secondary "Ver como funciona" (scroll suave pra seção)
    - **Visual à direita** (desktop) / abaixo (mobile): `BrowserFrame` com screenshot animado do dashboard OU vídeo loop muito curto (≤ 5s, autoplay muted) OU mockup estático bem-feito
    - Gradient blobs sutis no fundo, animados com `prefers-reduced-motion` respeitado
  - **Trust strip** (logo bar): faixa horizontal logo abaixo do hero com texto "Empresas que já usam:" + 5-8 logos (placeholder no MVP, posteriormente reais). Grayscale por padrão, color on hover.
  - Acessibilidade: H1 único na página, skip link funcional, contraste WCAG AA garantido mesmo sobre gradient
  - Performance: imagem hero otimizada (AVIF + WebP + fallback PNG), lazy load abaixo da dobra
- **Dependências**: Tasks 4.2, 4.3, 4.4
- **Notas técnicas**: copy precisa de 3-5 variações testadas. Não usar buzzwords vazias ("revolucionário", "disruptivo", "world-class"). Focar em **resultado** ("venda mais"), **mecanismo** ("links no automático"), **público** ("sua audiência"). O hero visual idealmente é screenshot real do dashboard pós-Fase 1 — se ainda não estiver pronto, usar mockup figmoso com `BrowserFrame.astro`. Animação do hero usa Motion One (3kb).

**Subtasks**:
- [ ] **4.5.1** — Brainstorm + redigir 5 variações de H1 + subhead; escolher 1 com o usuário
- [ ] **4.5.2** — Criar `sections/Hero.astro` com layout 2-col desktop / stacked mobile
- [ ] **4.5.3** — Adicionar eyebrow badge linkado pra showcase do Alli
- [ ] **4.5.4** — Implementar gradient blobs decorativos com SVG + CSS (não imagem)
- [ ] **4.5.5** — Inserir screenshot/mockup do dashboard em `BrowserFrame` com sombra elegante
- [ ] **4.5.6** — Animação de entrada sutil (fade-up) com Motion One, respeitando `prefers-reduced-motion`
- [ ] **4.5.7** — Criar `sections/TrustStrip.astro` com 5-8 logos placeholder (SVG cinza)
- [ ] **4.5.8** — Otimizar imagens via `astro:assets` (AVIF/WebP, dimensões corretas)
- [ ] **4.5.9** — Validar contraste e legibilidade do H1 sobre gradient em light + dark

---

#### Task 4.6 — Seção "Recursos principais" (Features)

- **Objetivo**: comunicar **3 a 6 features-âncora** que descrevem o produto. Cada feature ganha ícone + título + descrição curta + opcional mini-visual. Layout em grid responsivo.
- **Critério de aceite**:
  - Seção `Features.astro` com headline ("Tudo que você precisa pra escalar afiliados Shopee") + grid de cards
  - Mínimo de 6 features cobrindo:
    1. **Geração de links em massa** — cole várias URLs, receba todas convertidas
    2. **Multi-tenant + multi-time** — empresas, donos, funcionários, cada um com seu acesso
    3. **Dashboard com métricas** — produção diária, médias, top produtos
    4. **Modo TEST e PROD da Shopee** — homologação sem queimar quota real
    5. **Audit log + 2FA** — segurança bancária pro seu negócio
    6. **API + integração webhooks** (placeholder se ainda não existir — marcar como "em breve")
  - Cards com `IconBox` Lucide + título + 1-2 linhas; clique opcional pra modal/anchor com mais detalhes
  - Hover state sutil (lift + shadow), respeitando `prefers-reduced-motion`
  - Layout: 3 colunas desktop, 2 tablet, 1 mobile
- **Dependências**: Tasks 4.3, 4.5
- **Notas técnicas**: ícones Lucide consistentes (não misturar com outro set). Manter copy de cada card ≤ 100 caracteres. Se uma feature ainda não existe na app (ex.: webhooks), marcar com badge "Em breve" — manter honestidade.

**Subtasks**:
- [ ] **4.6.1** — Definir lista final de 6 features com o usuário (revisar quais já existem na app)
- [ ] **4.6.2** — Escrever copy: título + descrição (≤ 100 chars) pra cada
- [ ] **4.6.3** — Selecionar ícones Lucide pra cada feature (`Zap`, `Users`, `BarChart`, `TestTube`, `Shield`, `Webhook`)
- [ ] **4.6.4** — Criar `sections/Features.astro` com grid responsivo
- [ ] **4.6.5** — Adicionar hover state (lift + shadow + border highlight) com CSS puro
- [ ] **4.6.6** — Badge "Em breve" para features ainda não implementadas
- [ ] **4.6.7** — Validar legibilidade dos cards em dark mode

---

#### Task 4.7 — Showcase do módulo Alli (estrela da landing)

- **Objetivo**: o módulo Alli (Fase 3) é o **maior diferencial competitivo** — concorrentes não oferecem landing pública pronta. Essa seção precisa de destaque visual, mockup interativo e mostrar a magia: "Cada empresa ganha sua própria página de cupons em segundos".
- **Critério de aceite**:
  - Seção `AlliShowcase.astro` com:
    - Eyebrow "Exclusivo Come Pouco"
    - H2 forte: "Sua audiência converte sozinha. Direto da Shopee."
    - Subhead explicando: "Cada empresa tem uma URL própria (`/p/sua-loja`) onde seus seguidores colam qualquer link Shopee e voltam pra Shopee com seu link de afiliado aplicado."
    - **Demo interativa** (ilha JS mínima):
      - `PhoneFrame` à esquerda com mockup da landing pública
      - Input "fake" pré-preenchido com URL Shopee de exemplo
      - Botão "Buscar cupom" dispara animação: loading 1.5s → "Aplicando cupom..." → "Redirecionando..."
      - **Não chama backend real** — pura animação ilustrativa
    - À direita: 3 mini-benefícios com checkmark:
      - "Funciona com `shope.ee` e link longo"
      - "Atribuição por funcionário (`/p/loja/joao`)"
      - "Fallback automático se Shopee falhar"
    - CTA secundário "Ver demo ao vivo" abrindo `/p/demo` (slug reservado pra demo pública)
- **Dependências**: Tasks 4.2 (mockups), 4.3 (PhoneFrame); contextual: precisa que Fase 3 esteja documentada (já está)
- **Notas técnicas**: a demo interativa é a única ilha JS substancial da landing — manter ≤ 5kb. Pode usar Alpine.js (4kb) ou vanilla TS com Web Component. Animação CSS pura preferível. Slug `demo` precisa ser reservado na Fase 3 Task 3.1.7.

**Subtasks**:
- [ ] **4.7.1** — Criar `sections/AlliShowcase.astro` com layout 2-col
- [ ] **4.7.2** — Inserir `PhoneFrame` com screenshot/mockup do Alli público
- [ ] **4.7.3** — Implementar demo interativa em ilha (vanilla TS ou Alpine), zero chamadas reais
- [ ] **4.7.4** — Animação CSS: pulse de loading → checkmark → fade
- [ ] **4.7.5** — Lista de 3 benefícios com ícones Lucide (`Link`, `User`, `Shield`)
- [ ] **4.7.6** — CTA "Ver demo ao vivo" → `/p/demo` (criar slug reservado quando Fase 3 rodar)
- [ ] **4.7.7** — Validar performance: ilha não bloqueia LCP, anima só quando entra na viewport (`IntersectionObserver`)

---

#### Task 4.8 — Como funciona + Segurança (combinadas)

- **Objetivo**: dois blocos curtos e visuais — "Como funciona em 4 passos" (onboarding) e "Segurança que você espera" (confiança). Ambos contribuem pra conversão: o primeiro reduz incerteza, o segundo reduz medo.
- **Critério de aceite**:
  - **Como funciona**:
    - Headline "Comece em minutos"
    - 4 passos com ícone numerado + título + descrição curta:
      1. "Crie sua conta gratuita"
      2. "Conecte sua conta Shopee Afiliados"
      3. "Adicione seu time"
      4. "Compartilhe sua URL pública e venda"
    - Layout: horizontal timeline em desktop, vertical em mobile
    - Linha conectora SVG entre os passos com gradient sutil
  - **Segurança & confiança**:
    - Headline "Segurança é padrão, não opcional"
    - 6 selos/cards curtos: "2FA TOTP", "Criptografia AES-256 em repouso", "Audit log completo", "Conformidade LGPD", "Backups diários", "SSL/TLS em tudo"
    - Cada selo: ícone Lucide + título + 1 linha
    - Layout 3x2 desktop, 2x3 tablet, 1x6 mobile
  - Ambas as seções respeitam o ritmo visual da página (espaçamentos consistentes)
- **Dependências**: Tasks 4.3, 4.5
- **Notas técnicas**: a linha conectora entre passos é SVG inline (não imagem) — pode animar com `stroke-dasharray` quando entra na viewport. Selos de segurança: usar ícones específicos (`KeyRound`, `Lock`, `FileSearch`, `ShieldCheck`, `HardDriveDownload`, `Globe`). Texto deve refletir o que a app **realmente** entrega — pós-Fase 2, vários desses estarão implementados; se algum ainda não, ajustar copy ou remover.

**Subtasks**:
- [ ] **4.8.1** — Criar `sections/HowItWorks.astro` com timeline horizontal/vertical
- [ ] **4.8.2** — Implementar linha conectora SVG entre passos, animada com `stroke-dasharray`
- [ ] **4.8.3** — Criar `sections/Security.astro` com grid 3x2 de selos
- [ ] **4.8.4** — Auditar cada selo contra o que a app realmente entrega pós-Fase 2 (remover ou ajustar incertos)
- [ ] **4.8.5** — Adicionar microcopy "Veja detalhes técnicos →" linkando pra blog ou docs (futuro)

---

#### Task 4.9 — Pricing (3 tiers públicos) + Comparison table

- **Objetivo**: apresentar os planos de forma cristalina. Free pra atrair, Pro pra converter, Enterprise pra qualificar grandes contas. Tabela comparativa pra eliminar dúvidas.
- **Critério de aceite**:
  - Headline "Planos pra cada momento" + subhead curta
  - 3 cards lado a lado (em mobile, stacked):
    - **Free** — R$ 0 / mês — "Pra começar e validar"
      - Recursos listados: 1 empresa, 1 usuário, até 100 links/mês, módulo Alli básico, suporte por email
    - **Pro** (destacado, com badge "Mais escolhido") — R$ XX / mês — "Pra times sérios"
      - Recursos: até 5 usuários, links ilimitados, Alli com customização total, audit log, suporte prioritário
    - **Enterprise** — "Fale conosco" — "Pra operações grandes"
      - Recursos: usuários ilimitados, SLA, onboarding dedicado, API customizada, white-label (futuro)
  - CTA em cada card: "Começar grátis" / "Assinar Pro" / "Falar com vendas"
  - **Toggle** Mensal / Anual (com desconto ~20% no anual, badge "2 meses grátis")
  - **Tabela comparativa** completa abaixo dos cards: linha por recurso × coluna por plano, com checkmarks, X ou valor
  - Note de rodapé: "Sem cartão necessário no Free. Cancele a qualquer momento."
- **Dependências**: Tasks 4.3, 4.5; **decisão do usuário sobre valores** dos planos
- **Notas técnicas**: cards de pricing devem ter highlight visual claro no Pro (border colorida + sombra mais forte). Toggle mensal/anual pode ser ilha Alpine (~3kb) ou vanilla TS. Tabela comparativa em desktop é horizontal; em mobile, vira "swipe" lateral ou colapsa por plano (decidir pelo desempenho — preferir colapsar). Valores em placeholder até confirmar com usuário.

**Subtasks**:
- [ ] **4.9.1** — Definir com o usuário: valores mensais Pro, % desconto anual, limites exatos de cada plano
- [ ] **4.9.2** — Criar `sections/Pricing.astro` com 3 cards
- [ ] **4.9.3** — Implementar toggle Mensal/Anual (ilha JS mínima)
- [ ] **4.9.4** — Destacar plano Pro (border, shadow, badge "Mais escolhido")
- [ ] **4.9.5** — Criar `sections/PricingComparison.astro` com tabela completa
- [ ] **4.9.6** — Tabela comparativa: comportamento mobile (colapsar por plano com tabs)
- [ ] **4.9.7** — Wire-up dos CTAs: Free/Pro → `app.come-pouco.com.br/register?plan=...`; Enterprise → scroll para form de contato
- [ ] **4.9.8** — Note de rodapé com micropolíticas (sem cartão, cancele a qualquer momento)

---

#### Task 4.10 — FAQ + CTA final + Captura de lead

- **Objetivo**: três blocos que fecham a página — FAQ derruba objeções, CTA final converte quem chegou até o fim, formulário de captura pega quem não converteu ainda mas demonstrou interesse.
- **Critério de aceite**:
  - **FAQ**:
    - Headline "Perguntas frequentes"
    - 8-10 perguntas com accordion (`<details>` HTML nativo, zero JS)
    - Perguntas baseline (revisar com usuário):
      1. "Preciso ter conta na Shopee Afiliados?"
      2. "Como funciona o módulo Alli?"
      3. "Quantos links posso gerar?"
      4. "Posso adicionar funcionários?"
      5. "Meus dados estão seguros?"
      6. "Posso cancelar quando quiser?"
      7. "Tem teste grátis?"
      8. "Como integro com meu Instagram/TikTok?"
      9. "Posso ter mais de uma empresa?"
      10. "Vocês têm API?"
  - **CTA final**:
    - Banner grande com gradient (sutil, dentro da paleta)
    - Headline emocional: "Pronto pra parar de fazer link na mão?"
    - Subhead curta
    - 2 CTAs grandes: "Começar grátis" (primary) + "Agendar demo" (secondary)
  - **Captura de lead**:
    - Formulário simples acima do footer ou ao lado do CTA final
    - Campos: nome, email, mensagem opcional (ou: nome, email, "qual seu volume mensal?")
    - Submit → `POST /api/public/leads` no backend (reusa SystemEmailConfig pra enviar pro time)
    - Honeypot anti-spam (campo `website` hidden — mesma técnica da Fase 3)
    - Estados: idle / loading / success ("Obrigado, entraremos em contato!") / error
    - Endpoint no backend cria registro em nova tabela `Lead` (opcional, decidir com usuário) + envia email
- **Dependências**: Tasks 4.3, 4.5; **backend**: endpoint `POST /api/public/leads`
- **Notas técnicas**: `<details>` HTML nativo é acessível por padrão e zero JS — usar `+ summary` com chevron CSS rotacionado. Formulário com `fetch` ilha mínima (~2kb). Backend: endpoint público com rate limit (10/h/IP), validação zod (email), persist `Lead`, envia email. Considerar Schema.org `FAQPage` no markup pro SEO (Task 4.11).

**Subtasks**:
- [ ] **4.10.1** — Redigir 10 perguntas+respostas do FAQ com o usuário
- [ ] **4.10.2** — Criar `sections/FAQ.astro` com `<details>` nativo + estilização
- [ ] **4.10.3** — Adicionar schema.org `FAQPage` no markup (JSON-LD em `BaseLayout`)
- [ ] **4.10.4** — Criar `sections/FinalCTA.astro` com banner gradient
- [ ] **4.10.5** — Criar `sections/LeadForm.astro` com 3 campos + honeypot
- [ ] **4.10.6** — Backend: criar endpoint `POST /api/public/leads` com zod + rate limit + envio de email + persist
- [ ] **4.10.7** — Decidir com usuário se cria tabela `Lead` ou só dispara email (recomendado: tabela + email)
- [ ] **4.10.8** — Implementar estados do form (idle/loading/success/error) com aria-live
- [ ] **4.10.9** — Smoke test: submeter form e confirmar email recebido

---

#### Task 4.11 — SEO técnico, OG dinâmico, sitemap, schema.org

- **Objetivo**: garantir que a landing é descoberta, compartilhada com preview bonito e indexada corretamente. SEO técnico é barato e dá retorno enorme se feito desde o dia 1.
- **Critério de aceite**:
  - **Meta tags por página** via `BaseLayout`:
    - `<title>` único por página
    - `meta description` (≤ 160 chars) único
    - canonical URL
    - charset, viewport, theme-color (com variantes light/dark)
  - **Open Graph** + **Twitter Card** completos:
    - `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `og:locale=pt_BR`
    - `twitter:card=summary_large_image`, `twitter:title`, etc.
  - **OG image dinâmica**: gerada em build time via `@vercel/og` ou solução Astro nativa — template SVG com título + logo + gradient
  - **Sitemap.xml** gerado automaticamente via `@astrojs/sitemap`
  - **robots.txt** servido em `/robots.txt` com `Sitemap:` apontando pro sitemap
  - **Schema.org** JSON-LD:
    - `Organization` (logo, nome, sameAs com redes sociais)
    - `WebSite` (com `SearchAction` se houver busca futura)
    - `Product` (com `offers` apontando pros planos)
    - `FAQPage` (Task 4.10)
  - **Validações**:
    - Lighthouse SEO = 100
    - Google Rich Results Test passa em todos os schemas
    - Open Graph Debugger (Facebook + LinkedIn) renderiza preview correto
- **Dependências**: Tasks 4.4, 4.10
- **Notas técnicas**: OG image dinâmica em Astro pode usar `astro-og-canvas` (popular, sem dependência de Vercel) ou `satori` direto. Manter imagem em 1200×630 (padrão). JSON-LD vai inline no `<head>` em `<script type="application/ld+json">`. Em landing PT-BR, não precisa `hreflang` por enquanto.

**Subtasks**:
- [ ] **4.11.1** — Implementar `<head>` SEO completo em `BaseLayout` com props tipadas
- [ ] **4.11.2** — Adicionar Open Graph + Twitter Card meta tags
- [ ] **4.11.3** — Instalar e configurar `astro-og-canvas` (ou similar) pra OG image dinâmica
- [ ] **4.11.4** — Configurar `@astrojs/sitemap` no `astro.config.mjs`
- [ ] **4.11.5** — Criar `public/robots.txt` apontando pro sitemap
- [ ] **4.11.6** — Adicionar JSON-LD `Organization`, `WebSite`, `Product`, `FAQPage`
- [ ] **4.11.7** — Validar com Google Rich Results Test + Facebook Sharing Debugger
- [ ] **4.11.8** — Validar Lighthouse SEO = 100

---

#### Task 4.12 — Performance, a11y, dark mode, micro-animações

- **Objetivo**: o polimento final que separa "landing OK" de "landing referência". Lighthouse 100, zero violações axe-core, animações sutis e elegantes em todas as seções.
- **Critério de aceite**:
  - **Performance**:
    - Lighthouse Performance ≥ 95 mobile, ≥ 99 desktop
    - LCP < 1.5s mobile / < 1.0s desktop (4G simulado)
    - CLS < 0.05
    - JS total enviado < 30kb gzipped
    - CSS crítico inline, resto deferido
    - Todas as imagens em AVIF + WebP fallback, com `width/height` para evitar CLS
  - **Acessibilidade**:
    - axe-core: 0 violações
    - WCAG AA contraste em light + dark
    - Skip link funcional
    - Foco visível em todos os elementos interativos
    - Aria-labels em ícones-only buttons
    - `prefers-reduced-motion` respeitado em todas as animações
  - **Dark mode**:
    - Toggle 3-estados (light/dark/system) com persistência
    - FOUC zero
    - Todas as imagens com variantes light/dark onde fizer sentido (mockups especialmente)
  - **Micro-animações**:
    - Fade-up de seções ao entrar na viewport (Motion One, stagger sutil)
    - Hover states em cards (lift + shadow)
    - Botões com transição suave
    - Gradient blob com `prefers-reduced-motion` respeitado (estático se desabilitado)
- **Dependências**: todas as seções implementadas (4.4-4.10)
- **Notas técnicas**: Motion One é minúsculo (3kb) e usa `Web Animations API` nativa. Para detectar viewport entry, `IntersectionObserver` puro é suficiente. Imagens AVIF/WebP geradas pelo `astro:assets`. CSS crítico inline é automático no Astro 5.

**Subtasks**:
- [ ] **4.12.1** — Audit Lighthouse mobile e desktop, listar gaps, atacar um por um
- [ ] **4.12.2** — Audit axe-core e corrigir 100% das violações
- [ ] **4.12.3** — Adicionar `width/height` em todas as imagens (evita CLS)
- [ ] **4.12.4** — Instalar `motion` package, criar helper `animateOnEnter` reusável
- [ ] **4.12.5** — Aplicar fade-up stagger em todas as seções principais
- [ ] **4.12.6** — Validar `prefers-reduced-motion` em todas as animações
- [ ] **4.12.7** — Testar dark mode em todas as páginas e mockups
- [ ] **4.12.8** — Skip link funcional + foco visível auditado por teclado
- [ ] **4.12.9** — Benchmark final: rodar Lighthouse em 3 dispositivos diferentes, anexar prints em `docs/lighthouse.md`

---

#### Task 4.13 — Analytics privacy-first + conversion tracking

- **Objetivo**: medir o que importa sem invadir privacidade do visitante. Tráfego, conversões em CTAs, submissões de form. Sem cookies, sem GA4, sem 3rd parties barulhentos.
- **Critério de aceite**:
  - Plausible.io OU Umami self-hosted ativo na landing
  - Events trackeados:
    - `cta_click_hero_primary`
    - `cta_click_hero_secondary`
    - `cta_click_pricing_free`
    - `cta_click_pricing_pro`
    - `cta_click_pricing_enterprise`
    - `cta_click_final`
    - `lead_form_submit`
    - `lead_form_success`
    - `alli_demo_interact`
    - `pricing_toggle_yearly`
  - Dashboard de analytics acessível (Plausible cloud ou Umami self-hosted no mesmo Coolify)
  - Sem cookies, sem fingerprinting, sem consent banner necessário (LGPD compliance natural)
  - Script de analytics deferido, < 1kb
- **Dependências**: Task 4.10; decisão Plausible cloud vs Umami self-hosted
- **Notas técnicas**: Plausible cloud é mais simples (~$9/mês), Umami self-hosted é grátis mas exige manter container. Recomendação: começar com Umami no mesmo Coolify (zero custo, zero vendor lock-in). Migrar pra Plausible se time crescer. Eventos custom via `window.umami.track(name, props)`.

**Subtasks**:
- [ ] **4.13.1** — Decidir com usuário: Plausible cloud vs Umami self-hosted
- [ ] **4.13.2** — Provisionar instância (Umami via docker-compose no Coolify ou Plausible signup)
- [ ] **4.13.3** — Adicionar script no `BaseLayout` com `defer` + `data-website-id`
- [ ] **4.13.4** — Criar helper `trackEvent(name, props?)` em `src/lib/analytics.ts`
- [ ] **4.13.5** — Instrumentar todos os events listados
- [ ] **4.13.6** — Validar que sem-cookies funciona (DevTools → Application → Cookies vazio)
- [ ] **4.13.7** — Documentar eventos em `docs/analytics.md`

---

#### Task 4.14 — Deploy, CI/CD, custom domain, launch checklist

- **Objetivo**: pôr a landing no ar de forma confiável. Pipeline CI/CD, domínio custom configurado, certificado TLS, headers de segurança, checklist de lançamento completo.
- **Critério de aceite**:
  - Landing deployada em `come-pouco.com.br` (raiz) servindo HTTPS com TLS válido
  - App continua em `app.come-pouco.com.br` (separação clara de domínios)
  - DNS configurado: A/CNAME corretos, redirect `www → apex`
  - Pipeline CI/CD (GitHub Actions ou Coolify auto-deploy):
    - On push `main` → build → deploy se passar
    - Build em ~30s
    - Notification em Slack/Discord opcional
  - Headers de segurança server-side:
    - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
    - `Content-Security-Policy` específico (analytics, imagens, fonts permitidos)
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy` minimal
  - Cache headers corretos: assets com hash → 1 ano imutável; HTML → no-cache; OG images → 1 dia
  - Checklist de lançamento (`docs/launch-checklist.md`) com 30+ itens validados
- **Dependências**: todas as Tasks 4.1-4.13
- **Notas técnicas**: opções de deploy: **Coolify** no mesmo VPS (zero custo extra) ou **Cloudflare Pages** (CDN global grátis). Cloudflare Pages tem edge global e Lighthouse melhor; Coolify mantém tudo no mesmo lugar. Recomendação: começar Coolify, migrar pra CF Pages se latência global virar problema. CSP precisa permitir domínio de analytics e fontes externas (se houver).

**Subtasks**:
- [ ] **4.14.1** — Decidir host: Coolify (mesmo VPS) vs Cloudflare Pages
- [ ] **4.14.2** — Configurar DNS apex + www redirect
- [ ] **4.14.3** — Provisionar TLS (Let's Encrypt via Caddy/Traefik no Coolify, ou automático no CF)
- [ ] **4.14.4** — Configurar headers de segurança no servidor
- [ ] **4.14.5** — Pipeline CI/CD: GH Actions ou Coolify auto-deploy on push
- [ ] **4.14.6** — Smoke test pós-deploy: curl HEAD em todas as páginas + check de headers
- [ ] **4.14.7** — Validar HTTPS, redirect www, OG render, sitemap acessível
- [ ] **4.14.8** — Criar `docs/launch-checklist.md` com 30+ itens (SEO, perf, a11y, headers, analytics, conteúdo, legal)
- [ ] **4.14.9** — **Soft launch**: compartilhar com 5-10 pessoas próximas pra feedback antes do hard launch
- [ ] **4.14.10** — **Hard launch**: anúncio nas redes, atualizar bio Instagram/LinkedIn, post no LinkedIn

---

### Resumo da Fase 4 em uma página

**O que ganha**:
- Site institucional novo, separado da app, com domínio próprio (`come-pouco.com.br`)
- Apresentação visual de referência (padrão Linear/Vercel/Stripe) em PT-BR
- 3 tiers de pricing públicos → autosserviço pra Free/Pro, qualificação pra Enterprise
- Captura de lead conectada ao próprio SystemEmailConfig (sem dependência de Formspree/HubSpot)
- Showcase do módulo Alli como diferencial competitivo principal
- SEO bem feito + analytics privacy-first sem cookies
- Lighthouse ≥ 95 em todas as métricas, JS < 30kb gzipped
- Base sólida pra adicionar blog/casos depois (MDX já configurado)

**O que não ganha (adiado por escopo)**:
- Blog com posts iniciais (estrutura pronta, sem conteúdo)
- Casos de uso com depoimentos reais (placeholders no MVP)
- A/B testing
- CMS visual (conteúdo via PR)
- Live chat
- Versão inglês
- Páginas legais com revisão jurídica

**Stack nova introduzida**:
- Astro 5 + Tailwind v4 + Lucide Astro + Motion One (3kb) + MDX + `astro-og-canvas` + Umami/Plausible

**Riscos identificados**:
- Copywriting é o maior risco — visual não vende sozinho. Reservar tempo dedicado pra escrever e revisar 2-3 vezes.
- Mockups: depende de Fase 1 estar avançada. Se não, usar mockups figmosos no MVP e atualizar quando Fase 1 entregar.
- Domínio: validar se `come-pouco.com.br` (ou outro) está disponível e em mãos antes de começar.
- Lead form: rate limit + honeypot ajuda, mas spam ainda chega. Definir caixa de email de destino fora do email pessoal.

**Ordem de execução recomendada**:
1. Task 4.1 (setup Astro) — fundação
2. Task 4.2 (brand kit) — pode rodar em paralelo com 4.3
3. Task 4.3 (design system Astro) — habilita todas as seções
4. Task 4.4 (layout global) — header/footer/dark mode
5. Tasks 4.5 → 4.10 — seções da landing, em ordem (cada uma é independente, mas a ordem dá fluxo)
6. Task 4.11 (SEO) — depois que páginas existem
7. Task 4.12 (perf/a11y/animação) — polimento final
8. Task 4.13 (analytics) — pode entrar antes ou depois do polimento
9. Task 4.14 (deploy + launch) — fim, com checklist

**Dependência crítica com outras fases**:
- Idealmente Fase 1 (Design System) está pelo menos com Task 1.1 (paleta e tokens) terminada antes de começar 4.1 — assim a landing usa os mesmos tokens da app.
- Fase 3 (Alli) **não** precisa estar pronta — o showcase é demonstrativo. Mas se Fase 3 entrega antes, o CTA "Ver demo ao vivo" funciona pra valer.
- Fase 2 (Segurança) **não** bloqueia — mas selos de segurança da Task 4.8 ficam mais honestos pós-Fase 2.

