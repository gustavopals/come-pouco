# Security Audit Allowlist

This file documents accepted `npm audit` findings. The policy is intentionally
strict:

- Critical production vulnerabilities are not allowlisted and must block CI.
- High production vulnerabilities require an owner decision before merge.
- Moderate/low findings can be accepted only with a scope, mitigation, owner,
  and review date.
- `npm audit fix --force` is not used automatically because it can introduce
  major-version API changes.

## Current Accepted Findings

Generated on 2026-05-21 with:

```sh
npm run audit:prod
npm --prefix come-pouco-backend audit --audit-level=moderate
npm --prefix come-pouco-landing audit --audit-level=moderate
```

| Workspace            | Advisory                                                                | Severity | Scope                                           | Decision                                                                                                                                                                                                | Review                    |
| -------------------- | ----------------------------------------------------------------------- | -------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `come-pouco-backend` | `@hono/node-server <1.19.13` via `prisma` -> `@prisma/dev`              | Moderate | Dev tooling used by Prisma CLI, not app runtime | Accepted until Prisma publishes a compatible fix on the current major. The `npm audit fix --force` path downgrades Prisma to 6.x, so it is deferred to a planned Prisma upgrade review.                 | Next monthly major review |
| `come-pouco-landing` | `yaml 2.0.0 - 2.8.2` via `@astrojs/check` -> `@astrojs/language-server` | Moderate | Dev-only type/check tooling                     | Accepted because production audit is clean after moving `@astrojs/check` to `devDependencies`. The force fix downgrades `@astrojs/check`, so it is deferred until the toolchain has a compatible patch. | Next monthly major review |

## Empty Critical Allowlist

There are no accepted critical vulnerabilities. If `npm run audit:prod` fails,
the default action is to update, replace, or remove the affected dependency
before merging.
