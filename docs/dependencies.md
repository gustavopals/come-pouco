# Dependency Management

Come Pouco uses npm lockfiles per workspace:

- Root tooling: `package-lock.json`
- Backend: `come-pouco-backend/package-lock.json`
- Frontend: `come-pouco-frontend/package-lock.json`
- Landing: `come-pouco-landing/package-lock.json`

Renovate is configured in `renovate.json`.

## Update Policy

- Minor and patch updates run weekly on Monday after 06:00 BRT and are grouped
  into one PR per workspace.
- Major updates run monthly and stay as one PR per dependency for manual review.
- Lock file maintenance runs monthly.
- Vulnerability alerts create immediate PRs.
- Production security audit runs in CI with `npm run audit:prod` and fails on
  critical vulnerabilities.
- Accepted non-critical audit findings are tracked in
  `docs/security-audit-allowlist.md`.

## Core Dependencies

Core dependencies change app behavior, build behavior, database access, or
security posture. Review these PRs manually and run the relevant checks before
merge.

| Area               | Dependencies                                                                                              | Required checks                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Backend API        | `express`, `cors`, `helmet`, `express-rate-limit`, `compression`                                          | `npm run check:backend`, `npm run test:backend`, integration tests when routing/middleware changes |
| Database           | `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`                                                    | `npm --prefix come-pouco-backend run prisma:generate`, backend checks/tests, migration review      |
| Auth/security      | `jsonwebtoken`, `bcryptjs`, `otplib`, `ipaddr.js`, `lru-cache`                                            | Backend auth tests, integration login/2FA tests                                                    |
| Email              | `nodemailer`, `@aws-sdk/client-ses`                                                                       | `email.service` unit tests and smoke test against Mailpit/SMTP when behavior changes               |
| Frontend framework | `@angular/*`, `rxjs`, `typescript`, `@angular-eslint/*`                                                   | `npm run check:frontend`, `npm run test:frontend`                                                  |
| UI/tooling         | `@angular/material`, `@angular/cdk`, `@lucide/angular`, `tailwindcss`, `@tailwindcss/postcss`             | Frontend check/tests plus visual smoke of auth shell and key pages                                 |
| Landing framework  | `astro`, `@astrojs/mdx`, `@astrojs/sitemap`, `@tailwindcss/postcss`, `lucide-astro`                       | `npm run check:landing`, `npm run build:landing`                                                   |
| Observability      | `@sentry/node`, `@sentry/angular`, `@sentry/astro`, `pino`, `pino-http`, `prom-client`                    | Relevant package check/build and smoke of logging/metrics paths                                    |
| Tests/CI           | `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `supertest`, `msw`, `lefthook`, `eslint`, `prettier` | Lint, unit tests, `npm run e2e:list`; full E2E when Playwright or server startup changes           |

## Manual Review Checklist

For core dependency PRs:

1. Read release notes for breaking changes, security notes, and Node version
   requirements.
2. Avoid `npm audit fix --force` unless the major upgrade was reviewed and
   tested intentionally.
3. Regenerate generated clients when needed, especially Prisma.
4. Run `npm run audit:prod`, `npm run lint`, and the affected package checks.
5. Update `docs/security-audit-allowlist.md` if an accepted finding changes.

## Local Commands

```sh
npm run audit:prod
npm run audit:prod:backend
npm run audit:prod:frontend
npm run audit:prod:landing
```

Use full audits for investigation:

```sh
npm --prefix come-pouco-backend audit --audit-level=moderate
npm --prefix come-pouco-landing audit --audit-level=moderate
```
