# Copilot Instructions

## Project Overview

Monorepo: Angular 21 frontend + Node.js/Express 5/TypeScript backend, Prisma ORM, PostgreSQL via Docker.

- `come-pouco-frontend/` — Angular app (port 4200)
- `come-pouco-backend/` — Express API (port 3000)
- `database/init/` — SQL initialization scripts for Docker
- `docker-compose.yml` — local PostgreSQL instance

## Commands

### Root (monorepo)
```bash
npm run db:up           # start PostgreSQL via Docker
npm run db:down         # stop PostgreSQL
npm run dev:backend     # run backend in watch mode
npm run dev:frontend    # run frontend dev server
npm run check:backend   # TypeScript type-check backend (no emit)
```

### Backend (`come-pouco-backend/`)
```bash
npm run dev             # ts-node-dev watch mode
npm run check           # tsc --noEmit (type check only, no linter)
npm run build           # prisma generate + tsc
npm run prisma:migrate  # create and apply migration (dev)
npm run prisma:deploy   # apply existing migrations (prod/CI)
npm run prisma:generate # regenerate Prisma client
```

### Frontend (`come-pouco-frontend/`)
```bash
npm start               # ng serve
npm run build           # ng build
npm test                # vitest (via ng test)
```

No single-test command is configured; vitest supports `--reporter` and `--testNamePattern` flags if needed.

## Architecture

### Backend request flow
Routes (`src/routes/`) → Controllers (`src/controllers/`) → Services (`src/services/`) → Prisma client (`src/config/prisma.ts`).

- **Controllers** are thin: validate inputs, call services, call `next(error)` on failure.
- **Services** contain all business logic and Prisma queries.
- **`HttpError`** (`src/utils/httpError.ts`) is the only error type thrown deliberately. The global error handler in `app.ts` converts it to `{ message }` JSON; 500+ errors are logged server-side only.
- `req.userId` and `req.userRole` are injected by `authMiddleware` and consumed by controllers/middlewares downstream.

### Auth flow
1. `authMiddleware` validates the JWT, fetches the user role from DB, and attaches `req.userId` / `req.userRole`.
2. `roleMiddleware` checks `req.userRole` against allowed roles.
3. Protected routes compose both: `[authMiddleware, roleMiddleware(['ADMIN'])]`.

### Frontend architecture
- **Angular signals** are used for reactive state in services (e.g., `currentUserSignal` in `AuthService`).
- **Functional guards** (`authGuard`, `adminGuard`, `guestGuard`) protect routes in `app.routes.ts`.
- **`authInterceptor`** automatically attaches `Authorization: Bearer <token>` to all requests matching `environment.apiUrl`, and redirects to `/login` on 401.
- API base URL comes from `src/environments/environment.ts` → `environment.apiUrl`.
- JWT and user data are stored in `localStorage` under keys `come_pouco_token` and `come_pouco_user`.

## Key Conventions

### Backend
- All errors thrown in controllers/services must be `HttpError` instances for proper HTTP responses. Generic `Error` throws result in 500.
- Prisma schema uses `@map` to bridge snake_case DB columns to camelCase TypeScript fields. Always define both when adding columns.
- Environment config is centralized in `src/config/env.ts`. Add new env vars there and to `.env.example`.
- `DATABASE_URL` is auto-built from individual `DB_*` vars if not explicitly set.

### Frontend
- Services are `providedIn: 'root'` (singleton). Use Angular signals for state that multiple components consume.
- Prettier config: `printWidth: 100`, `singleQuote: true`, Angular parser for HTML templates.
- No separate linting script; use `tsc --noEmit` for type checking.

## Local Dev Setup

```bash
docker compose up -d                         # start DB
cd come-pouco-backend && cp .env.example .env
npm install && npm run prisma:deploy         # apply migrations
npm run dev                                  # start API
# in another terminal:
cd come-pouco-frontend && npm install && npm start
```

Test credentials: `admin` / `comepouco102030@`

For DB schema resets in dev: `docker compose down -v && docker compose up -d`
