# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Come Pouco is a multi-tenant SaaS for managing affiliate-link generation, primarily against the Shopee Affiliate GraphQL API. Each `Company` has its own affiliates (`User` with `companyRole=EMPLOYEE`) who generate shortened/tracked affiliate URLs scoped to that company. The system supports both a TEST (sandbox) and a PROD Shopee credential per company, plus a global mock mode for development without real Shopee credentials. Global `ADMIN` users manage companies, platforms, system email config, and view aggregated API usage.

Monorepo:
- `come-pouco-backend/` — Express 5 + TypeScript + Prisma ORM, API on port 3000 at `/api`
- `come-pouco-frontend/` — Angular 21 + Angular Material, dev server on port 4200
- `database/init/` — PostgreSQL init SQL (Docker entrypoint)
- `docker-compose.yml` — local PostgreSQL 16

## Commands

### Root (`/opt/come-pouco`)
```bash
npm run db:up             # Start PostgreSQL via Docker Compose
npm run db:down           # Stop PostgreSQL
npm run dev:backend       # Start backend dev server
npm run dev:frontend      # Start frontend dev server
npm run check:backend     # TypeScript type-check (no emit)
npm run build:frontend    # Build Angular app
npm run smoke:postdeploy  # Run post-deploy smoke tests
```

### Backend (`come-pouco-backend/`)
```bash
npm run dev               # ts-node-dev with hot reload (also runs prisma generate)
npm run build             # prisma generate + tsc -> dist/
npm start                 # node dist/server.js
npm run start:prod        # prisma migrate deploy + node dist/server.js
npm run check             # tsc --noEmit
npm run prisma:generate   # Regenerate Prisma client
npm run prisma:migrate    # Create + apply dev migration (prisma migrate dev)
npm run prisma:deploy     # Apply migrations (production)
npm run auth:check        # Validate auth schema state (scripts/auth-hardening-check.js)
npm run auth:smoke        # Smoke-test auth/2FA against a running backend
npm run smoke:postdeploy  # End-to-end smoke (login, Shopee, 2FA, cleanup)
```

### Frontend (`come-pouco-frontend/`)
```bash
npm start                 # ng serve with proxy.conf.json
ng build                  # Build to dist/
ng test                   # Vitest unit tests
ng generate component <name>
```

### Database reset (dev)
```bash
docker compose down -v && docker compose up -d
```

## Architecture

### Backend layout (`src/`)
- `server.ts` — entry. On boot: `checkDatabaseConnection` -> `ensureDatabaseSchema` (dev only, fails fast if `users` table is missing 2FA columns or the master admin row) -> `startHistoryCleanupJob` -> `app.listen`.
- `app.ts` — Express app, custom CORS allow-list with wildcard suffix support (`*.example.com`), JSON body parser, global error handler returning `{ message, errorCode, details? }` (`details` only in `APP_ENV=development`).
- `config/env.ts` — typed env config. `DATABASE_URL` wins; otherwise built from `DB_HOST/PORT/NAME/USER/PASSWORD`. In production, throws if `JWT_SECRET` or `TWOFA_ENCRYPTION_KEY` are still the dev defaults.
- `config/prisma.ts` — Prisma client singleton.
- `routes/index.ts` — mounts all routers under `/api`. `authMiddleware` is applied per-router (NOT globally); `/auth` is partially public, while `/companies` and `/admin` add `requireRole('ADMIN')`.
- `middlewares/auth.middleware.ts` — verifies JWT, loads role + companyId from DB, injects `req.userId`, `req.userRole`, `req.companyId`, `req.companyRole`. Translates Prisma `P2022/P2021` into `AUTH_SCHEMA_OUTDATED`, and JWT errors into `AUTH_TOKEN_INVALID` / `AUTH_TOKEN_EXPIRED`.
- `middlewares/role.middleware.ts` — `requireRole(...UserRole[])` factory (gates only on global role, not `CompanyRole`).
- `controllers/` — thin HTTP layer per resource.
- `services/` — business logic and Prisma access. Notable: `shopee-integration.service.ts` (orchestrates mock vs real), `shopee-affiliate-client.service.ts` (GraphQL client + signature), `api-usage.service.ts` (admin reports), `system-email-config.service.ts` + `services/email/email.service.ts` (multi-provider SMTP/Resend/SES/SendGrid/Mailgun).
- `jobs/history-cleanup.job.ts` — `node-cron` job at `0 3 * * *` deletes `affiliate_links` older than each company's `historyRetentionDays` (skips companies where it is `NULL` or `<= 0`). Started from `server.ts`.
- `utils/httpError.ts` — `new HttpError(statusCode, message, errorCode?, details?)`; throw these from controllers/services and the global handler formats them.
- `utils/totp.ts`, `utils/crypto.ts` — 2FA TOTP + AES encryption for `two_factor_secret` (keyed by `TWOFA_ENCRYPTION_KEY`).
- `types/express/index.d.ts` — augments `Request` with the user context fields.

### Backend route map (`/api/...`)
- `GET  /health` — public liveness probe
- `/auth/*` — public: `login`, `login/2fa` (also aliased as `2fa/verify`), `register`, `forgot-password`, `reset-password`. Authenticated: `me`, `2fa/setup`, `2fa/confirm` (also `2fa/enable`), `2fa/disable`, `trusted-devices` (GET/DELETE). Note: `auth.routes.ts` registers `register` twice — public + authenticated — because Express resolves the first match, public registration is still possible unless gated upstream (`noPublicRegisterGuard` exists on the frontend).
- `/dashboard/production-summary` — authenticated
- `/users` — list/create/update/delete; `POST /users/employees` lets an OWNER create an EMPLOYEE within their own company
- `/companies` — ADMIN only (CRUD)
- `/affiliate-links` — list/create/update/delete; visibility is scoped server-side (EMPLOYEE sees own, OWNER sees company-wide, ADMIN sees all)
- `/purchase-platforms` — list/CRUD; `GET|PUT /:id/companies` manages the platform-company links
- `/integrations/shopee/generate-shortlinks` — main Shopee integration endpoint
- `/admin/*` — ADMIN only: `api-usage` (GET + `DELETE /api-usage/mock`), `users/:id/reset-2fa`, `email-config` (GET/PUT/POST test)

### Auth flow
1. `POST /api/auth/login` returns either `AuthResponse` (token + user) **or** `{ requiresTwoFactor: true, tempToken }`
2. `POST /api/auth/login/2fa` resolves the TOTP challenge (and optionally creates a trusted device via `trustDevice: true`)
3. JWT is stored in `localStorage` as `come_pouco_token`; user object as `come_pouco_user`. Default expiry `8h` (`JWT_EXPIRES_IN`).
4. Trusted-device tokens are hashed and persisted in `TrustedDevice`; default lifetime is `TRUSTED_DEVICE_DAYS=30`.
5. Password reset uses `PasswordResetToken` (hashed) sent by email; the email transport is resolved from `SystemEmailConfig` (one row, `id=1`) — provider can be SMTP, Resend, SES, SendGrid, or Mailgun.

### Role model
- **ADMIN** (`UserRole`) — global, sees/manages everything
- **USER** (`UserRole`) — scoped to a company via `companyId` + `companyRole`
  - **OWNER** (`CompanyRole`) — manages their company's EMPLOYEES; can configure company-level settings (`my-company` page)
  - **EMPLOYEE** (`CompanyRole`) — generates affiliate links; only sees their own

### Shopee integration model
- `PurchasePlatform` rows hold credentials (`appId`, `secret`, `apiUrl`, `accessKey`, `apiLink`) and a per-platform `mockMode` flag.
- Each `Company` references up to three platforms: `shopeePlatformTestId`, `shopeePlatformProdId`, and a legacy `shopeePlatformId`. `Company.shopeeMode` (`TEST` or `PROD`) selects which credential is used when an OWNER/EMPLOYEE generates links.
- `SHOPEE_MOCK=true` (env) or `PurchasePlatform.mockMode=true` short-circuits to deterministic fake shortlinks (no outbound HTTP).
- Every shortlink attempt (real or mock, success or failure) writes one row to `ApiRequestLog` — drives the admin "API Usage" dashboard.

### Data model highlights (Prisma)
- `Company` (1—N) `User`, `AffiliateLink`, `CompanyPlatform`, `ApiRequestLog`; (N—1) Shopee `PurchasePlatform` per mode (TEST/PROD/legacy)
- `User` has `role` (ADMIN/USER) + optional `companyId` + `companyRole` (OWNER/EMPLOYEE); 2FA fields (encrypted `twoFactorSecret`, pending secret for setup), backup codes, trusted devices, password reset tokens
- `PurchasePlatform` — currently only `type=SHOPEE`; has `mockMode` and `isActive` flags
- `CompanyPlatform` — explicit join table, separate from the three legacy/test/prod FKs on `Company`
- `ApiRequestLog` — one row per integration call, mode `MOCK|REAL`, `success` bool
- `SystemEmailConfig` — single-row table (`id=1`), holds the active email provider config
- `historyRetentionDays` on `Company` drives the daily 03:00 cleanup job for `affiliate_links`

### Frontend layout (`src/app/`)
- `core/services/` — `AuthService` (Angular signals for `currentUser`), plus services for company, user, affiliate-link, purchase-platform, dashboard, admin email config
- `core/interceptors/auth.interceptor.ts` — attaches `Authorization: Bearer <token>` to `/api` requests, `withCredentials: true`. Auto-logout only on `AUTH_TOKEN_INVALID` / `AUTH_TOKEN_EXPIRED` (and not while on auth/2FA endpoints, to avoid logging out mid-login)
- `core/guards/` — `authGuard`, `guestGuard`, `adminGuard`, `ownerGuard`, `usersCreateGuard`, `noPublicRegisterGuard`
- `core/models/` — DTOs mirroring backend responses (auth, company, user, purchase-platform, affiliate-link, email-config)
- `pages/` — `login`, `register`, `forgot-password`, `reset-password`, `home`, `app-layout` (shell), `affiliate-links`, `users`, `companies`, `my-company`, `purchase-platforms`, `admin-email-settings`, `security` (2FA + trusted devices)
- `shared/components/confirm-dialog` — reusable Material confirm dialog
- `environments/environment.ts` — `apiUrl: '/api'` (relative). In dev, `proxy.conf.json` forwards `/api` to `http://localhost:3001` — note this is **not** the backend's default port `3000`; either run the backend with `PORT=3001` or update `proxy.conf.json` if you change ports.

### Error response format
```json
{ "message": "...", "errorCode": "AUTH_TOKEN_EXPIRED", "details": {} }
```
`details` is included only when `APP_ENV=development`. The frontend interceptor branches on `errorCode`, not on HTTP status.

Auth error codes (non-exhaustive): `AUTH_TOKEN_MISSING`, `AUTH_TOKEN_INVALID`, `AUTH_TOKEN_EXPIRED`, `AUTH_INVALID_CREDENTIALS`, `AUTH_INVALID_2FA_CODE`, `AUTH_2FA_NOT_ENABLED`, `AUTH_2FA_ALREADY_ENABLED`, `AUTH_2FA_SETUP_NOT_STARTED`, `AUTH_2FA_SETUP_EXPIRED`, `AUTH_2FA_STATE_INVALID`, `AUTH_TRUSTED_DEVICE_NOT_FOUND`, `AUTH_IDENTIFIER_CONFLICT`, `AUTH_USER_NOT_FOUND`, `AUTH_SCHEMA_OUTDATED`, `AUTH_FORBIDDEN`.

## Backend environment variables
Copy `come-pouco-backend/.env.example` to `.env`. Notable vars:
- `DATABASE_URL` (preferred) or `DB_HOST/PORT/NAME/USER/PASSWORD`
- `JWT_SECRET` — **required** in production (boot fails otherwise)
- `JWT_EXPIRES_IN` — default `8h`
- `TWOFA_ENCRYPTION_KEY` — **required** in production; used to encrypt stored TOTP secrets
- `APP_ENV` — `development` | `production`. In development, the server boot validates auth schema columns and the seeded master admin; in production these checks are skipped to avoid blocking deploys.
- `CORS_ORIGINS` — comma-separated; supports `*` and `*.host` wildcards
- `SHOPEE_MOCK=true` — force-mock all Shopee shortlink generation
- `TRUSTED_DEVICE_DAYS` — default 30
- `PUBLIC_APP_URL` — used in password-reset emails

## Legacy DB baseline
Some environments predate the Prisma migration history. See `come-pouco-backend/docs/db-baseline.md` for the `prisma migrate resolve --applied ...` sequence and the `npm run auth:check` validation step.

## Smoke test environment variables (`smoke:postdeploy`)
- `POST_DEPLOY_SMOKE_BASE_URL` (default `http://localhost:3000/api`)
- `POST_DEPLOY_SMOKE_TIMEOUT_MS` (default `15000`)
- `POST_DEPLOY_SMOKE_ADMIN_IDENTIFIER` (default `admin`), `..._ADMIN_PASSWORD`, `..._ADMIN_2FA_CODE`
- `POST_DEPLOY_SMOKE_COMPANY_NAME`, `..._OWNER_PASSWORD`, `..._EMPLOYEE_PASSWORD`
- `POST_DEPLOY_SMOKE_KEEP_DATA=true` to keep generated test data

## Testing credentials (local)
- Username: `admin`
- Password: `comepouco102030@`
