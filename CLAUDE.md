# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Come Pouco is a multi-tenant SaaS for managing affiliate-link generation, primarily against the Shopee Affiliate GraphQL API. Each `Company` has its own affiliates (`User` with `companyRole=EMPLOYEE`) who generate shortened/tracked affiliate URLs scoped to that company. The system supports both a TEST (sandbox) and a PROD Shopee credential per company, plus a global mock mode for development without real Shopee credentials. Global `ADMIN` users manage companies, platforms, system email config, and view aggregated API usage.

Monorepo:

- `come-pouco-backend/` — Express 5 + TypeScript + Prisma ORM, API on port 3000 at `/api`
- `come-pouco-frontend/` — Angular 21 + Angular Material, dev server on port 4200
- `come-pouco-landing/` — Astro 5 + Tailwind v4 institutional/marketing site, dev server on port 4321 (Fase 4)
- `e2e/` — Playwright specs and helpers for browser-level critical flows
- `database/init/` — PostgreSQL init SQL (Docker entrypoint)
- `docker-compose.yml` — local PostgreSQL 16

## Commands

### Root (`/opt/come-pouco`)

```bash
npm run db:up             # Start PostgreSQL via Docker Compose
npm run db:down           # Stop PostgreSQL
npm run dev:backend       # Start backend dev server (port 3000)
npm run dev:frontend      # Start frontend dev server (port 4200)
npm run dev:landing       # Start Astro landing dev server (port 4321)
npm run dev:all           # Backend + frontend + landing em paralelo
npm run lint              # ESLint shared flat config + Prettier check
npm run lint:fix          # ESLint --fix across the monorepo
npm run format            # Prettier --write across supported files
npm run format:check      # Prettier --check across supported files
npm run lefthook:install  # Install git hooks from lefthook.yml
npm run check             # Type-check backend, frontend, and landing
npm run build:ci          # Build all packages without running Prisma deploy
npm run check:backend     # TypeScript type-check (no emit)
npm run check:frontend    # Angular development build as a type/template check
npm run check:landing     # astro check
npm run test:backend      # Backend Vitest unit suite
npm run test:backend:cov  # Backend Vitest coverage
npm run test:frontend     # Frontend Vitest unit suite
npm run test:frontend:cov # Frontend Vitest coverage
npm run build:frontend    # Build Angular app
npm run build:landing     # Build Astro static site to come-pouco-landing/dist
npm run e2e:install       # Install Playwright browsers
npm run e2e:list          # List E2E specs without starting Docker/web servers
npm run e2e               # Start Postgres/Mailpit + backend/frontend/landing and run Playwright headless
npm run e2e:headed        # Same suite with headed browser
npm run smoke:postdeploy  # Run post-deploy smoke tests
```

### Backend (`come-pouco-backend/`)

```bash
npm run dev               # ts-node-dev with hot reload (also runs prisma generate)
npm run build             # prisma generate + tsc -> dist/
npm start                 # node dist/server.js
npm run start:prod        # prisma migrate deploy + node dist/server.js
npm run check             # tsc --noEmit
npm test                  # Vitest unit/integration specs
npm run test:unit         # Vitest without tests/integration
npm run test:integration  # Integration specs with RUN_INTEGRATION_TESTS=true and real Postgres
npm run test:watch        # Vitest watch mode
npm run test:cov          # Vitest with V8 coverage report
npm run prisma:generate   # Regenerate Prisma client
npm run prisma:migrate    # Create + apply dev migration (prisma migrate dev)
npm run prisma:deploy     # Apply migrations (production)
npm run secrets:migrate   # Idempotently encrypt existing at-rest secrets with enc:v1:
npm run auth:check        # Validate auth schema state (scripts/auth-hardening-check.js)
npm run auth:smoke        # Smoke-test auth/2FA against a running backend
npm run smoke:postdeploy  # End-to-end smoke (login, Shopee, 2FA, cleanup)
```

### Frontend (`come-pouco-frontend/`)

```bash
npm start                 # ng serve with proxy.conf.json
ng build                  # Build to dist/
npm test                  # Vitest unit tests
npm run test:watch        # Vitest watch mode
npm run test:cov          # Vitest + coverage text/lcov/json-summary
ng generate component <name>
```

### Landing (`come-pouco-landing/`)

```bash
npm run dev               # astro dev (port 4321)
npm run build             # astro build → dist/ (HTML estático)
npm run preview           # serve build local
npm run check             # astro check (typecheck .astro + tsx)
```

### Database reset (dev)

```bash
docker compose down -v && docker compose up -d
```

## Architecture

### Backend layout (`src/`)

- `server.ts` — entry. On boot: `checkDatabaseConnection` -> `ensureDatabaseSchema` (dev only, fails fast if `users` table is missing 2FA columns or the master admin row) -> `startHistoryCleanupJob` -> `startConversionRetentionJob` -> `app.listen`.
- `app.ts` — Express app, `trust proxy=1`, Helmet security headers with CSP in report-only mode, request-id header (`X-Request-Id`), custom CORS allow-list with wildcard suffix support (`*.example.com`), compression, JSON/urlencoded body parsers limited to `256kb`, global error handler returning `{ message, errorCode, requestId?, details? }` (`details` only in `APP_ENV=development`, except validation errors; 5xx responses are sanitized as `INTERNAL_ERROR` with stack only in logs).
- `config/env.ts` — typed env config. `DATABASE_URL` wins; otherwise built from `DB_HOST/PORT/NAME/USER/PASSWORD`. In production, throws if `JWT_SECRET` or `TWOFA_ENCRYPTION_KEY` are still the dev defaults.
- `config/prisma.ts` — Prisma client singleton. Production logs `warn/error`; development also emits query events and logs slow queries (`>=500ms`) as warnings.
- `routes/index.ts` — mounts all routers under `/api`. `authMiddleware` is applied per-router (NOT globally); `/auth` is partially public, while `/companies` and `/admin` add `requireRole('ADMIN')`.
- `middlewares/auth.middleware.ts` — verifies JWT, rejects tokens issued before `User.passwordChangedAt`, loads role + companyId from a 30s in-memory user cache, injects `req.userId`, `req.userRole`, `req.companyId`, `req.companyRole`. Translates Prisma `P2022/P2021` into `AUTH_SCHEMA_OUTDATED`, and JWT errors into `AUTH_TOKEN_INVALID` / `AUTH_TOKEN_EXPIRED`.
- `middlewares/role.middleware.ts` — `requireRole(...UserRole[])` factory (gates only on global role, not `CompanyRole`).
- `middlewares/request-id.middleware.ts` — accepts a safe inbound `X-Request-Id` or generates a UUID, stores it in `req.id`, and echoes it in the response.
- `middlewares/rate-limit.middleware.ts` — in-memory `express-rate-limit` factory and limiters for auth and Shopee shortlink generation.
- `schemas/` — Zod schemas grouped by domain (`auth`, `users`, `companies`, `affiliate-links`, `integration`, `purchase-platforms`, `admin`). Routes call `validate({ body?, query?, params? })` before controllers.
- `controllers/` — thin HTTP layer per resource.
- `services/` — business logic and Prisma access. Notable: `auth-lockout.service.ts` (in-memory auth failure lockouts), `audit.service.ts` (fire-and-forget sensitive event audit trail), `shopee-integration.service.ts` (orchestrates mock vs real), `shopee-affiliate-client.service.ts` (GraphQL client + signature), `api-usage.service.ts` (admin reports), `conversion-retention.service.ts` (LGPD anonymization for public conversions), `public-module-metrics.service.ts` (admin public-module metrics), `system-email-config.service.ts` + `services/email/email.service.ts` (multi-provider SMTP/Resend/SES/SendGrid/Mailgun).
- `jobs/history-cleanup.job.ts` — `node-cron` job at `0 3 * * *` deletes expired rows from `affiliate_links`, `api_request_logs`, and `audit_logs`. Affiliate link retention is per-company (`historyRetentionDays`); API/audit retention comes from env. The job logs row count and relation size before/after each table cleanup. Started from `server.ts`.
- `jobs/conversion-retention.job.ts` — `node-cron` job at `30 3 * * *` anonymizes `conversions` older than `CONVERSION_RETENTION_DAYS` (default 180), clearing `ipHash`, `userAgent`, and `referrer` while retaining aggregate conversion history.
- `utils/httpError.ts` — `new HttpError(statusCode, message, errorCode?, details?)`; throw these from controllers/services and the global handler formats them.
- `utils/validate.ts` — generic Zod validation middleware. It returns `400 { message: 'Dados invalidos.', errorCode: 'VALIDATION_ERROR', details: [...] }` and includes details in all environments.
- `utils/pagination.ts` — shared page-based pagination helper. Defaults: `page=1`, `limit=20`, `maxLimit=100`; paginated responses expose `data`, `items`, and `meta`.
- `utils/cache.ts` + `cache/public.cache.ts` — in-memory LRU cache with TTL, single-flight `getOrSet`, and hit/miss stats for public-module shortlink and conversion caching. The interface is intentionally small so it can be swapped for Redis later without changing callers.
- `utils/totp.ts`, `utils/crypto.ts` — 2FA TOTP + AES encryption for `two_factor_secret` (keyed by `TWOFA_ENCRYPTION_KEY`).
- `utils/encryption.ts` — central AES-256-GCM helper for operational secrets. New encrypted values are tagged with `enc:v1:`; legacy plaintext values still decrypt as-is until `npm run secrets:migrate` is run.
- `types/express/index.d.ts` — augments `Request` with the user context fields.

### Backend route map (`/api/...`)

- `GET  /health` — public liveness probe
- `/auth/*` — public: `login`, `login/2fa` (also aliased as `2fa/verify`), `forgot-password`, `reset-password`. Authenticated: `register` (ADMIN only), `me`, `2fa/setup`, `2fa/confirm` (also `2fa/enable`), `2fa/disable`, `trusted-devices` (GET/DELETE). Rate limits: `login` 5/15min/IP, `login/2fa` and `2fa/verify` 10/15min/IP, `forgot-password` 3/h/IP.
- `/public/*` — public Alli module: `GET /healthz`, `GET /landing/:slug`, `POST /convert`, and `POST /leads`. Public landing is limited to 60/min/IP; public conversion is limited to 30/min/IP plus 200/day/IP with IPv6 `/64` grouping. Public request metadata is sanitized before persistence, IPs are stored as HMAC hashes (`PUBLIC_IP_HASH_SALT`), and conversion logs use `[public-convert]` with `requestId`, slugs, status, and response time.
- `/dashboard/production-summary` — authenticated
- `/users` — list/create/update/delete; `POST /users/employees` lets an OWNER create an EMPLOYEE within their own company
- `/users/:id/public-slug` — ADMIN can update user public slugs; OWNER can update EMPLOYEE slugs inside their own company
- `/companies` — ADMIN-only CRUD plus OWNER/ADMIN public landing management: `GET|PUT /:id/landing-config`, `PUT /:id/public-slug`, `PUT /:id/fallback-url`
- `/affiliate-links` — list/create/update/delete; visibility is scoped server-side (EMPLOYEE sees own, OWNER sees company-wide, ADMIN sees all)
- `/purchase-platforms` — list/CRUD; `GET|PUT /:id/companies` manages the platform-company links
- `/integrations/shopee/generate-shortlinks` — main Shopee integration endpoint; rate limited to 30/min/authenticated user
- `/admin/*` — ADMIN only: `audit-logs` (GET paginado com filtros), `api-usage` (GET paginado + `DELETE /api-usage/mock`), `cache-stats` (GET public cache metrics), `GET /metrics/public-module`, `DELETE /conversions/anonymize?olderThan=...`, `users/:id/reset-2fa`, `email-config` (GET/PUT/POST test)

### Auth flow

1. `POST /api/auth/login` returns either `AuthResponse` (token + user) **or** `{ requiresTwoFactor: true, tempToken }`
2. `POST /api/auth/login/2fa` resolves the TOTP challenge (and optionally creates a trusted device via `trustDevice: true`)
3. JWT is stored in `localStorage` as `come_pouco_token`; user object as `come_pouco_user`. Default expiry `8h` (`JWT_EXPIRES_IN`).
4. Trusted-device tokens are hashed and persisted in `TrustedDevice`; default lifetime is `TRUSTED_DEVICE_DAYS=30`.
5. JWTs include `authIssuedAt` in milliseconds. `authMiddleware` rejects tokens older than `User.passwordChangedAt` (with `iat` fallback for legacy tokens), so password changes revoke active sessions.
6. Failed auth attempts are lockout-protected in memory: 5 failed `/auth/login` attempts per normalized identifier lock that identifier for 15min; 5 failed 2FA attempts per challenged user lock 2FA for 15min.
7. Password reset uses `PasswordResetToken` (hashed) sent by email; the email transport is resolved from `SystemEmailConfig` (one row, `id=1`) — provider can be SMTP, Resend, SES, SendGrid, or Mailgun. `forgot-password` returns a generic success response whether the email exists or not.

### Role model

- **ADMIN** (`UserRole`) — global, sees/manages everything
- **USER** (`UserRole`) — scoped to a company via `companyId` + `companyRole`
  - **OWNER** (`CompanyRole`) — manages their company's EMPLOYEES; can configure company-level settings (`my-company` page)
  - **EMPLOYEE** (`CompanyRole`) — generates affiliate links; only sees their own

### Shopee integration model

- `PurchasePlatform` rows hold credentials (`appId`, encrypted `secret`, `apiUrl`, encrypted legacy `accessKey`, `apiLink`) and a per-platform `mockMode` flag.
- Each `Company` references up to three platforms: `shopeePlatformTestId`, `shopeePlatformProdId`, and a legacy `shopeePlatformId`. `Company.shopeeMode` (`TEST` or `PROD`) selects which credential is used when an OWNER/EMPLOYEE generates links.
- `SHOPEE_MOCK=true` (env) or `PurchasePlatform.mockMode=true` short-circuits to deterministic fake shortlinks (no outbound HTTP).
- Every shortlink attempt (real or mock, success or failure) writes one row to `ApiRequestLog` — drives the admin "API Usage" dashboard.

### Data model highlights (Prisma)

- `Company` (1—N) `User`, `AffiliateLink`, `CompanyPlatform`, `ApiRequestLog`; (N—1) Shopee `PurchasePlatform` per mode (TEST/PROD/legacy)
- `User` has `role` (ADMIN/USER) + optional `companyId` + `companyRole` (OWNER/EMPLOYEE); `passwordChangedAt` for session invalidation; 2FA fields (encrypted `twoFactorSecret`, pending secret for setup), backup codes, trusted devices, password reset tokens
- `PurchasePlatform` — currently only `type=SHOPEE`; has `mockMode` and `isActive` flags. `secret` and legacy `accessKey` are encrypted at rest and only returned masked by the API.
- `CompanyPlatform` — explicit join table, separate from the three legacy/test/prod FKs on `Company`
- `ApiRequestLog` — one row per integration call, mode `MOCK|REAL`, `success` bool
- `Conversion` — one row per public conversion attempt, with company/employee attribution, Shopee product ids, status, mode, response time, hashed IP, sanitized user-agent/referrer, and public dashboard fields. `conversion-retention.job.ts` anonymizes personal metadata after `CONVERSION_RETENTION_DAYS`.
- `AuditLog` — one row per sensitive auth/admin event (`eventType`, optional `userId`, entity, IP, user-agent, metadata JSON, success flag). Indexed by `(userId, createdAt)`, `(eventType, createdAt)`, and `createdAt`.
- `SystemEmailConfig` — single-row table (`id=1`), holds the active email provider config. SMTP password and provider API keys are encrypted at rest and returned masked by the admin API.
- `historyRetentionDays` on `Company` drives the daily 03:00 cleanup job for `affiliate_links`

### Frontend styling

- `DESIGN.md` — design system source of truth. The active palette is **Jade Signal** (light/dark), with Manrope typography, 4px spacing scale, 8px default card/control radius, subtle shadows, and reduced-motion-safe motion tokens.
- `src/styles/tokens.scss` — CSS custom properties with `--cp-*` tokens for light mode and `html.dark/.dark` overrides for dark mode. Legacy variables (`--layout-*`, `--panel-*`, `--brand-*`) are aliased here while the redesign is in progress.
- `src/styles.scss` — global base styles plus Angular Material 21 custom MD3 theme via `mat.theme()`/`mat.theme-overrides()`. The prebuilt `azure-blue` theme has been removed from `angular.json`.
- `src/styles/tailwind.css`, `tailwind.config.ts`, `postcss.config.json` — Tailwind CSS 4 integration through `@tailwindcss/postcss`; Tailwind colors/spacing/radii/shadows consume the `--cp-*` tokens.
- `core/services/theme.service.ts` — `ThemeService` with signal `currentTheme` (`light | dark | system`), `effectiveTheme`, localStorage persistence (`come_pouco_theme`), `prefers-color-scheme` listener, and `<html>` class toggling.
- `@lucide/angular` — official Lucide Angular package. `app.config.ts` registers the currently used icon set through `provideLucideIcons`; add icons there before using new string names via `app-icon`.
- `shared/components/` — design-system component layer: `app-logo`, `page-header`, `empty-state`, `skeleton-loader`, `status-chip`, `theme-toggle`, `icon`, `icon-button`, `auth-shell`, `otp-input`, and the refactored `confirm-dialog`. Components are standalone, token-driven, and exported from `shared/components/index.ts`.

### Frontend layout (`src/app/`)

- `core/services/` — `AuthService` (Angular signals for `currentUser`), `ThemeService` (signals for light/dark/system theme), plus services for company, user, affiliate-link, purchase-platform, dashboard, admin email config. List services accept `{ page, limit }` and share `pagination-params.ts`.
- `core/interceptors/auth.interceptor.ts` — attaches `Authorization: Bearer <token>` to `/api` requests, `withCredentials: true`. Auto-logout only on `AUTH_TOKEN_INVALID` / `AUTH_TOKEN_EXPIRED` (and not while on auth/2FA endpoints, to avoid logging out mid-login)
- `core/guards/` — `authGuard`, `guestGuard`, `adminGuard`, `ownerGuard`, `usersCreateGuard`, `noPublicRegisterGuard`
- `core/models/` — DTOs mirroring backend responses (auth, company, user, purchase-platform, affiliate-link, email-config)
- `pages/` — `login`, `register`, `forgot-password`, `reset-password`, `home`, `app-layout` (shell), `affiliate-links`, `users`, `companies`, `my-company`, `purchase-platforms`, `admin-email-settings`, `security` (2FA + trusted devices)
- `pages/app-layout/components/` — authenticated app shell pieces: `SidebarComponent` (grouped role-aware nav, desktop rail mode), `TopbarComponent` (breadcrumbs slot, theme toggle, user menu), and `BreadcrumbsComponent` (derived from `route.data.breadcrumb`). Sidebar collapsed state persists in `localStorage` as `come_pouco_sidebar_state`.
- Auth pages (`login`, `register`, `forgot-password`, `reset-password`) share `AuthShellComponent` for the split-screen brand/form layout. 2FA entry uses `OtpInputComponent` for 6-digit TOTP with autofocus, paste handling, and keyboard navigation; backup-code paths remain text-input based where needed.
- Public Alli pages live under lazy route `/p/:companySlug` in `src/app/public/`. They bypass the authenticated shell and `AuthInterceptor` skips `/api/public/*`. `PublicLandingService` caches `GET /api/public/landing/:slug` in a signal for 5 minutes, and `PublicLayoutComponent` applies `LandingConfig.primaryColor` as `--public-primary`.
- `shared/components/confirm-dialog` — reusable Material confirm dialog with Lucide icon, tone variants, and token-based styling
- `shared/components/theme-toggle` — reusable Material theme toggle/menu backed by `ThemeService` and Lucide icons
- `environments/environment.ts` — `apiUrl: '/api'` (relative). In dev, `proxy.conf.json` forwards `/api` to `http://localhost:3001` — note this is **not** the backend's default port `3000`; either run the backend with `PORT=3001` or update `proxy.conf.json` if you change ports.

### Landing layout (`come-pouco-landing/src/`)

- `styles/tokens.css` — CSS vars portadas da Fase 1 (Jade Signal) com adições de marketing (`--cp-mkt-*`). Light em `:root, html.light`; dark em `html.dark`. `prefers-reduced-motion` neutraliza animações via media query global.
- `styles/global.css` — entrada Tailwind v4 com `@import "tailwindcss"`, `@theme` mapeando os tokens em utilitários (`bg-primary`, `text-ink`, etc.) e `@variant dark` controlado pela classe `.dark` no `<html>`.
- `layouts/BaseLayout.astro` — layout único de todas as páginas. Renderiza `SeoHead`, script inline anti-FOUC de tema, `SchemaJsonLd`, `Header`, `<main>` com skip link e `Footer`. Props: `title`, `description`, `ogImage?`, `canonical?`, `bare?`, `schemaType?`, `schemaData?`.
- `components/ui/` — primitivos: `Container` (page/narrow/prose/full), `Section` (spacing + tone + divider), `Button` (4 variants × 3 sizes), `Badge`, `Card`, `IconBox`, `Icon` (dispatcher Lucide), `GradientBlob`, `BrowserFrame`, `PhoneFrame`.
- `components/brand/` — `Logo` (wordmark + monograma) e `LogoMark` (símbolo isolado, color/mono).
- `components/seo/` — `SeoHead` (title, description, canonical, OG, Twitter Card, manifest, fonts) e `SchemaJsonLd` (Organization sempre, mais um dos tipos `WebSite | Product | FAQPage`).
- `components/layout/` — `Header` (sticky + backdrop blur), `Footer` (4 colunas + redes sociais), `MobileNav` (drawer com `<dialog>` HTML nativo) e `ThemeToggle` (3 estados, persistido em `localStorage` como `come_pouco_theme`).
- `components/sections/` — `Hero`, `TrustStrip`, `Features`, `AlliShowcase` (com ilha de demo interativa puramente ilustrativa), `HowItWorks`, `Security`, `Pricing` (com toggle Mensal/Anual), `PricingComparison`, `FAQ` (com `<details>` nativo + JSON-LD), `FinalCTA`, `LeadForm` (honeypot + submit AJAX).
- `lib/` — conteúdo declarativo: `features.ts` (cards + selos + passos + benefícios do Alli), `plans.ts` (3 tiers + tabela comparativa), `faq.ts`, `navigation.ts`, `analytics.ts` (`trackEvent` + `attachEventTracking` auto-bind em `data-event`).
- `pages/` — `index.astro` (home), `404.astro`, `dev/components.astro` (galeria visível só em `import.meta.env.DEV`).
- `astro.config.mjs` — `site` lido de `PUBLIC_SITE_URL`, integrations `@astrojs/sitemap` e `@astrojs/mdx`, Tailwind via `@tailwindcss/vite`. Output estático (`output: 'static'`).
- `public/` — `favicon.svg`, `manifest.json`, `robots.txt`, `og/default.svg`, `illustrations/*.svg`.
- `docs/` — `brand.md`, `voice.md`, `analytics.md`, `launch-checklist.md`, `lighthouse.md`.

### Landing — lead capture endpoint

- `POST /api/public/leads` (público, rate-limited a 10/h/IP, honeypot `website`) — persiste em `leads` e dispara email fire-and-forget para `LEAD_NOTIFY_EMAIL` (default `contato@come-pouco.com.br`) usando o transporter `SystemEmailConfig` já existente.
- `model Lead` (Prisma): `id`, `name`, `email`, `volume?`, `message?`, `source` (default `landing`), `ipAddress?`, `userAgent?`, `notified` (atualizado quando o email sai), `createdAt`. Indexado em `createdAt` e `email`.

### E2E testing

- Playwright lives at the monorepo root (`playwright.config.ts`) and discovers specs in `e2e/specs/`.
- `npm run e2e` first runs `docker compose up -d postgres mailpit`, then Playwright auto-starts backend (`PORT=3001`, `SHOPEE_MOCK=true`), Angular frontend (`4200`), and Astro landing (`4321`) via `webServer`.
- Frontend API proxy targets `http://localhost:3001`; keep backend E2E on port `3001` unless proxy config changes.
- Helpers in `e2e/helpers/` seed isolated data with `e2e-<uuid>` values using the backend Prisma Client, configure Mailpit SMTP, and can login via API to avoid repeated UI setup.
- Useful overrides: `E2E_SKIP_WEBSERVER=true` when using already-running servers, plus `E2E_BACKEND_URL`, `E2E_FRONTEND_URL`, `E2E_LANDING_URL`, `E2E_MAILPIT_URL`, and `DATABASE_URL`.
- Public Alli E2E is in `e2e/specs/public-alli.spec.ts` and covers URL longa, shortlink, URL invalida inline, honeypot, fallback, slug inexistente, and employee slug invalido. Backend E2E sets `SHORTLINK_MOCK_TARGET_URL` and `SHOPEE_MOCK_FAILURE_PATTERN=e2e-force-fallback` so CI never depends on Shopee real.
- Current executable specs cover login+2FA, affiliate link generation in Shopee MOCK mode, public Alli conversion, and password reset via Mailpit. Billing checkout is present as a skipped placeholder until Fase 7 implements `/api/billing/*` and `/my-company/billing`.

### CI/CD

- GitHub Actions workflow lives at `.github/workflows/ci.yml` and runs on pull requests to `main` plus pushes to `main`.
- CI jobs are `lint`, `type-check`, `test-backend`, `test-frontend`, `coverage-comment`, `build`, and gated `e2e`.
- `lint` runs the shared ESLint flat config plus Prettier check.
- Node dependencies use `actions/setup-node@v4` npm cache. The E2E job also caches `~/.cache/ms-playwright`.
- Backend and frontend coverage jobs upload `coverage-backend` and `coverage-frontend` artifacts. Pull requests get one updated coverage summary comment through `actions/github-script`.
- The `e2e` job runs only on pushes to `main` or PRs with label `e2e`; it uses GitHub service containers for PostgreSQL and Mailpit, then Playwright starts the app servers and applies backend migrations through `npm run e2e:server:backend`.
- Branch protection settings are documented in `.github/branch-protection.md`; apply them in GitHub after the `CI` workflow has run at least once so the checks are selectable.

### Code quality

- Root `eslint.config.mjs` is the source of truth. Package wrappers in `come-pouco-backend/eslint.config.mjs`, `come-pouco-frontend/eslint.config.mjs`, and `come-pouco-landing/eslint.config.mjs` import the root config.
- ESLint is pinned to v9 because the Astro plugin flat config is not compatible with ESLint 10 in this repo yet.
- Type-aware rules use `tsconfig.eslint.json`; keep new root-level TypeScript config files included there if they need linting.
- Prettier is configured in `.prettierrc` with width 100, single quotes, no trailing commas, and `prettier-plugin-astro`.
- Lefthook uses `lefthook.yml`: `pre-commit` runs Prettier + ESLint fix on staged files; `pre-push` runs `npm run check`, `npm run test:backend`, and `npm run test:frontend`.

### Error response format

```json
{ "message": "...", "errorCode": "AUTH_TOKEN_EXPIRED", "details": {} }
```

`details` is included only when `APP_ENV=development`. The frontend interceptor branches on `errorCode`, not on HTTP status.

Auth error codes (non-exhaustive): `AUTH_TOKEN_MISSING`, `AUTH_TOKEN_INVALID`, `AUTH_TOKEN_EXPIRED`, `AUTH_INVALID_CREDENTIALS`, `AUTH_LOGIN_LOCKED`, `AUTH_INVALID_2FA_CODE`, `AUTH_2FA_LOCKED`, `AUTH_2FA_NOT_ENABLED`, `AUTH_2FA_ALREADY_ENABLED`, `AUTH_2FA_SETUP_NOT_STARTED`, `AUTH_2FA_SETUP_EXPIRED`, `AUTH_2FA_STATE_INVALID`, `AUTH_TRUSTED_DEVICE_NOT_FOUND`, `AUTH_IDENTIFIER_CONFLICT`, `AUTH_USER_NOT_FOUND`, `AUTH_SCHEMA_OUTDATED`, `AUTH_FORBIDDEN`.

Validation error code: `VALIDATION_ERROR`. Unlike most `details`, validation `details` are returned outside development because clients need field-level feedback.

### HTTP hardening and rate limits

- Helmet is enabled for security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, CSP report-only).
- Every response gets `X-Request-Id`; server 500 logs include `requestId`, while the response body stays generic: `{ message: 'Erro interno', errorCode: 'INTERNAL_ERROR', requestId }`.
- Body parsers are capped at `256kb`; oversized bodies return `PAYLOAD_TOO_LARGE`.
- Rate limits are in-memory: `/auth/login` 5/15min/IP, `/auth/login/2fa` + `/auth/2fa/verify` 10/15min/IP, `/auth/forgot-password` 3/h/IP, `/integrations/shopee/generate-shortlinks` 30/min/user.
- Public module rate limits use `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers. `/api/public/landing/:slug` is 60/min/IP. `/api/public/convert` is 30/min/IP plus a rolling 200/day/IP window. IPv6 clients are grouped by `/64`; rate-limit hits are written as `PUBLIC_RATE_LIMIT_HIT` audit events with hashed IPs.
- Auth lockout is separate from IP rate limits: `/auth/login` locks by normalized identifier after 5 failures/15min, and `/auth/login/2fa` locks by challenged user after 5 invalid codes/15min.

### Input validation

- All routes with `body`, `query`, or `params` input are validated with Zod schemas before reaching controllers.
- New passwords are validated server-side: minimum 10 chars, at least 1 letter and 1 number, no spaces, no triple repeated chars, no obvious sequences/words such as `123456`, `abcdef`, `qwerty`, `password`, or `senha`.
- Existing/current passwords are only checked as non-empty when used for login or disabling 2FA; strength rules apply to new passwords only.

### Audit log

- Sensitive auth/admin actions are written to `audit_logs` via `audit.service.ts`.
- Writes are fire-and-forget: audit DB failures are logged as warnings and never fail the original request.
- Covered events include auth login/fail, 2FA login/fail/setup/disable, password reset, trusted-device revoke, admin user/company/platform CRUD, email-config update, and admin reset-2FA.
- `GET /api/admin/audit-logs?page=1&limit=20&eventType=AUTH_LOGIN_FAIL&userId=1&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` returns `{ logs, data, items, meta }`.

### Pagination and query performance

- List endpoints accept `page` and `limit`: `/affiliate-links`, `/users`, `/companies`, `/purchase-platforms`, `/admin/api-usage`, and `/admin/audit-logs`.
- The response shape keeps resource aliases for compatibility and exposes `data/items/meta`, where `meta` has `{ page, limit, total, totalPages }`.
- Angular list pages use server-side `MatPaginator` for affiliate links, users, companies, purchase platforms, and the API usage log table.
- Added indexes: `users(company_id)`, `purchase_platforms(type, is_active)`, `audit_logs(user_id, created_at)`, and `audit_logs(event_type, created_at)`. Existing `affiliate_links(company_id, created_at)` supports company-scoped history.
- The Shopee GraphQL client uses `AbortSignal.timeout(10_000)` and maps timeout failures to `504`.

## Backend environment variables

Copy `come-pouco-backend/.env.example` to `.env`. Notable vars:

- `DATABASE_URL` (preferred) or `DB_HOST/PORT/NAME/USER/PASSWORD`
- `JWT_SECRET` — **required** in production (boot fails otherwise)
- `JWT_EXPIRES_IN` — default `8h`
- `TWOFA_ENCRYPTION_KEY` — **required** in production; used to encrypt stored TOTP secrets, Shopee secrets, and email-provider secrets
- `APP_ENV` — `development` | `production`. In development, the server boot validates auth schema columns and the seeded master admin; in production these checks are skipped to avoid blocking deploys.
- `CORS_ORIGINS` — comma-separated; supports `*` and `*.host` wildcards
- `SHOPEE_MOCK=true` — force-mock all Shopee shortlink generation
- `SHOPEE_MOCK_FAILURE_PATTERN` — optional test hook; in mock mode, origin URLs containing this substring return a failed mock result so fallback paths can be tested
- `TRUSTED_DEVICE_DAYS` — default 30
- `API_REQUEST_LOG_RETENTION_DAYS` — default 90
- `AUDIT_LOG_RETENTION_DAYS` — default 365
- `CONVERSION_RETENTION_DAYS` — default 180; controls public conversion metadata anonymization
- `PUBLIC_APP_URL` — used in password-reset emails
- `SHORTLINK_MOCK_TARGET_URL` — optional target URL used to expand `shope.ee` shortlinks while `SHOPEE_MOCK=true`

## Legacy DB baseline

Some environments predate the Prisma migration history. See `come-pouco-backend/docs/db-baseline.md` for the `prisma migrate resolve --applied ...` sequence and the `npm run auth:check` validation step.

## At-rest secrets

Operational secrets use `enc:v1:` AES-256-GCM ciphertexts. See `come-pouco-backend/docs/secrets.md` for the field list, `npm run secrets:migrate`, dry-run mode, and key rotation procedure.

## Data retention

See `come-pouco-backend/docs/data-retention.md` and `docs/lgpd-public-module.md`. Defaults: `affiliate_links` follows `Company.historyRetentionDays`, `api_request_logs` uses `API_REQUEST_LOG_RETENTION_DAYS=90`, `audit_logs` uses `AUDIT_LOG_RETENTION_DAYS=365`, and `conversions` anonymizes personal metadata after `CONVERSION_RETENTION_DAYS=180`.

## Backend tests

Contributor-facing testing guidance lives in `docs/testing.md`; onboarding and PR workflow live in `docs/contributing.md`.

Backend tests use Vitest with `come-pouco-backend/vitest.config.ts`. Unit specs can be co-located as `src/**/*.spec.ts`; shared and integration specs can live under `come-pouco-backend/tests/**/*.spec.ts`.

- Global setup: `tests/setup.ts` clears Vitest mocks and unstubs env/globals after each test.
- Prisma unit mocks: `tests/helpers/prisma-mock.ts` wraps `vitest-mock-extended`.
- DB integration helper: `tests/helpers/prisma-test.ts` creates an isolated PostgreSQL schema named `test_<uuid>`, runs `prisma migrate deploy` against it, and exposes a cleanup function that drops the schema.
- HTTP integration helper: `tests/helpers/request.ts` wraps `supertest(app)` so specs exercise the Express app without calling `listen`.
- App integration helper: `tests/helpers/integration-test-app.ts` sets test env vars, creates a fresh schema, imports `src/app`, and restores env/tears down the schema after the suite.
- Test data factories: `tests/factories/` exposes builders for `Company`, `User`, `PurchasePlatform`, `AffiliateLink`, and `LandingConfig`.
- Current backend unit coverage focuses on critical services: auth, auth lockout, Shopee integration/client, public conversion, affiliate links, audit, and email providers.
- Integration specs live under `tests/integration/` and are skipped in normal `npm test` unless `RUN_INTEGRATION_TESTS=true` is set. Use `TEST_DATABASE_URL` to point integration tests at a non-default Postgres database; otherwise the helper falls back to `DATABASE_URL` and then the local docker-compose URL.

## Coverage reporting

- CI publishes `coverage-backend`, `coverage-frontend`, and `coverage-landing` artifacts on every PR.
- `coverage-comment` uses `scripts/coverage/comment-pr.mjs` to upsert one PR comment with package totals, changed-file coverage, and changed files with no coverage entry.
- README coverage badges are local SVGs under `.github/badges/` and can be refreshed after local coverage runs with `npm run coverage:badges`.
- Coverage targets are currently advisory: backend critical services target 60% lines, frontend core services/guards target 45% lines, and landing content libs target 45% lines. Watermarks live in the relevant Vitest/Angular test configs; the custom comment marks `WARN` without failing the build.

## Dependency management and audits

- Renovate is configured in `renovate.json`: weekly grouped minor/patch PRs per workspace, monthly individual major PRs, monthly lockfile maintenance, and immediate vulnerability alert PRs.
- Production audit runs with `npm run audit:prod`, which checks root, backend, frontend, and landing with `--omit=dev --audit-level=critical`.
- CI has a dedicated `audit` job that runs the production audit on every PR/push.
- Accepted non-critical findings live in `docs/security-audit-allowlist.md`. Critical findings are not allowlisted.
- Core dependency review policy lives in `docs/dependencies.md`.

## Smoke test environment variables (`smoke:postdeploy`)

- `POST_DEPLOY_SMOKE_BASE_URL` (default `http://localhost:3000/api`)
- `POST_DEPLOY_SMOKE_TIMEOUT_MS` (default `15000`)
- `POST_DEPLOY_SMOKE_ADMIN_IDENTIFIER` (default `admin`), `..._ADMIN_PASSWORD`, `..._ADMIN_2FA_CODE`
- `POST_DEPLOY_SMOKE_COMPANY_NAME`, `..._OWNER_PASSWORD`, `..._EMPLOYEE_PASSWORD`
- `POST_DEPLOY_SMOKE_PUBLIC_SLUG`, `..._PUBLIC_FALLBACK_URL`, `..._PUBLIC_CONVERSION_URL`
- `POST_DEPLOY_SMOKE_KEEP_DATA=true` to keep generated test data

## Testing credentials (local)

- Username: `admin`
- Password: `comepouco102030@`

## Development plan rules (IDEIA.md §17)

When the user shares an idea, requirement, or improvement direction, it goes into [IDEIA.md](IDEIA.md) section **17. Plano de desenvolvimento** following a strict hierarchy:

```
Fase N — <macro goal / milestone>
├── Task N.M — <concrete deliverable>
│   ├── Subtask N.M.K — <atomic step, ~1 PR>
│   └── Subtask N.M.K — ...
```

### Rules to follow when elaborating the plan

- **Three levels, always**: Fase → Task → Subtask. Never flatten or skip a level.
- **Fase** = thematic milestone (e.g., "Foundation of Quality", "Observability"). Has a clear "done" criterion.
- **Task** = measurable deliverable inside the Fase. Each Task must specify:
  - **Objetivo** — what + why
  - **Critério de aceite** — how to know it's done
  - **Dependências** — prerequisite Tasks/Fases (or `nenhuma`)
  - **Notas técnicas** — libs, design choices, risks
- **Subtask** = atomic step in infinitive form ("Adicionar X", "Configurar Y"), small enough for one focused PR.
- **Aim for first-class application**: every Task considers tests, observability, security, performance, accessibility, and docs — not as afterthoughts.
- **No functional regressions**: each Fase keeps the app running; each Subtask leaves the app compiling.
- **Best practices by default**: SOLID, clean code, separation of concerns, tests live near the code they test.
- **Validate thoroughly**: every implementation should follow programming best practices and include appropriate verification, such as type-checks, unit/integration tests, builds, smoke tests, or focused manual checks according to the risk of the change.
- **Keep docs in sync**: when a Task changes behavior or stack, update [CLAUDE.md](CLAUDE.md) and [IDEIA.md](IDEIA.md) (other sections too, not just §17).
- **Numbering is stable**: once a Fase/Task/Subtask is numbered, don't renumber later additions. Append new ones at the end of their level.
- **Status tracking**: as Subtasks are completed, mark them with a checkbox (`- [x]`) or a `✅` prefix. Leave pending ones unchecked.
- **Implementation completion tracking**: whenever implementing any Task or Subtask from [IDEIA.md](IDEIA.md), update §17 in the same change to mark the completed item(s) as done; if all Subtasks under a Task are complete, mark the parent Task complete as well.
- **Ask before assuming scope**: when the user's idea is ambiguous, ask 1-3 targeted questions before writing the plan; better to clarify than to scaffold a wrong plan.

When the user sends a new idea, the workflow is:

1. Confirm understanding (briefly summarize what you understood).
2. Ask clarifying questions if scope is ambiguous.
3. Propose the Fase/Tasks/Subtasks breakdown — append to §17.
4. Wait for approval before implementing any code.
