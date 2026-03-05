# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Come Pouco is a monorepo with an Angular frontend and an Express + TypeScript backend for managing affiliate links (primarily Shopee integration) across multiple companies.

## Commands

### Root (run from `/opt/come-pouco`)
```bash
npm run db:up          # Start PostgreSQL via Docker Compose
npm run db:down        # Stop PostgreSQL
npm run dev:backend    # Start backend dev server
npm run dev:frontend   # Start frontend dev server
npm run check:backend  # TypeScript type-check (no emit)
npm run smoke:postdeploy  # Run post-deploy smoke tests
```

### Backend (`come-pouco-backend/`)
```bash
npm run dev              # Start with ts-node-dev (hot reload)
npm run build            # Compile TypeScript to dist/
npm run check            # tsc --noEmit type check
npm run prisma:migrate   # Create and apply dev migration
npm run prisma:deploy    # Apply migrations (production)
npm run prisma:generate  # Regenerate Prisma client
```

### Frontend (`come-pouco-frontend/`)
```bash
npm start    # ng serve on port 4200
ng build     # Build to dist/
ng test      # Run Vitest tests
ng generate component <name>  # Scaffold new component
```

### Database reset (dev)
```bash
docker compose down -v && docker compose up -d
```

## Architecture

### Monorepo structure
- `come-pouco-backend/` — Express 5 + TypeScript + Prisma ORM, API on port 3000 at `/api`
- `come-pouco-frontend/` — Angular 21, dev server on port 4200
- `database/init/` — PostgreSQL init SQL for Docker
- `docker-compose.yml` — PostgreSQL 16 with `come_pouco_db`

### Backend layout (`src/`)
- `server.ts` — entry point
- `app.ts` — Express app setup, CORS config, error handler
- `config/env.ts` — typed env config with defaults; reads `DATABASE_URL` or individual `DB_*` vars
- `config/prisma.ts` — Prisma client singleton
- `routes/index.ts` — mounts all routers under `/api`, applies `authMiddleware` globally (except `/auth`)
- `controllers/` — one file per resource
- `middlewares/auth.middleware.ts` — JWT verification, injects `req.userId`, `req.userRole`, `req.companyId`, `req.companyRole`
- `middlewares/role.middleware.ts` — `requireRole(...roles)` factory
- `services/` — business logic, Prisma queries
- `utils/httpError.ts` — `HttpError(statusCode, message, errorCode?, details?)` used throughout

### Frontend layout (`src/app/`)
- `core/services/` — `AuthService` (uses Angular signals), `CompanyService`, `UserService`, `AffiliateLinkService`, `PurchasePlatformService`
- `core/interceptors/auth.interceptor.ts` — attaches `Authorization: Bearer <token>` to all `/api` requests; auto-logout on `AUTH_TOKEN_INVALID` / `AUTH_TOKEN_EXPIRED`
- `core/guards/` — `authGuard`, `guestGuard`, `adminGuard`, `ownerGuard`, `usersCreateGuard`, `noPublicRegisterGuard`
- `pages/` — one directory per route/view
- `shared/components/` — reusable UI components (e.g., `ConfirmDialog`)
- `environments/environment.ts` — `apiUrl: '/api'` (proxied in production; CORS handles it in dev)

### Auth flow
1. `POST /api/auth/login` — returns either a full `AuthResponse` (token + user) or a `{ requiresTwoFactor: true, tempToken }` challenge
2. `POST /api/auth/login/2fa` — resolves the 2FA challenge with a TOTP code
3. JWT stored in `localStorage` as `come_pouco_token`; user object as `come_pouco_user`

### Role model
- **ADMIN** (`UserRole`) — global admin, sees/manages everything
- **USER** (`UserRole`) — scoped to their company
  - **OWNER** (`CompanyRole`) — manages their company's employees and config
  - **EMPLOYEE** (`CompanyRole`) — generates affiliate links, sees only their own links

### Data model highlights (Prisma)
- `Company` → has many `User`, `AffiliateLink`, `CompanyPlatform`, `ApiRequestLog`
- `User` → has `role` (ADMIN/USER) and optional `companyId` + `companyRole` (OWNER/EMPLOYEE)
- `PurchasePlatform` — currently only SHOPEE; has `mockMode` flag for sandbox testing
- `CompanyPlatform` — join table linking companies to platforms
- `TrustedDevice` — persisted trusted device tokens (hashed)
- `TwoFactorBackupCode` — hashed backup codes for 2FA

### Error response format
```json
{ "message": "...", "errorCode": "AUTH_TOKEN_EXPIRED", "details": {} }
```
`details` is only included in `APP_ENV=development`.

## Backend environment variables
Copy `come-pouco-backend/.env.example` to `.env`:
- `DATABASE_URL` or individual `DB_HOST/PORT/NAME/USER/PASSWORD`
- `JWT_SECRET` — required in production
- `TWOFA_ENCRYPTION_KEY` — required in production
- `APP_ENV` — `development` | `production`
- `CORS_ORIGINS` — comma-separated origins
- `SHOPEE_MOCK=true` — enables mock Shopee shortlink generation (no real API credentials needed)
- `TRUSTED_DEVICE_DAYS` — default 30

## Testing credentials (local)
- Username: `admin`
- Password: `comepouco102030@`
