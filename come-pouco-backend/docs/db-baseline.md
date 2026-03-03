# DB Baseline e Consistencia de Auth

Este projeto possui ambientes legados em que o schema pode existir sem historico Prisma completo (`P3005`).

## Objetivo

Garantir que as colunas e tabelas de autenticacao (username + 2FA + trusted device) existam e que o Prisma nao quebre em deploy.

## Procedimento recomendado (ambiente legado)

1. Aplicar SQL incremental idempotente da auth:

```sql
-- arquivo:
prisma/migrations/202603020001_auth_username_2fa/migration.sql
```

2. Marcar migrations antigas como aplicadas no `_prisma_migrations` com `migrate resolve`:

```bash
npx prisma migrate resolve --applied 202602270001_init
npx prisma migrate resolve --applied 202602270002_user_role
npx prisma migrate resolve --applied 202602270004_purchase_platforms
npx prisma migrate resolve --applied 202602280010_affiliate_links_sub_id_1
npx prisma migrate resolve --applied 202602280020_purchase_platforms_shopee_fields
npx prisma migrate resolve --applied 202602280030_multi_company
npx prisma migrate resolve --applied 202602280040_company_shopee_platform
npx prisma migrate resolve --applied 202602280120_company_shopee_test_prod_mode
npx prisma migrate resolve --applied 202602280200_purchase_platform_mock_mode
npx prisma migrate resolve --applied 202602280300_company_platforms
npx prisma migrate resolve --applied 202603020001_auth_username_2fa
```

3. Validar consistencia:

```bash
npm run auth:check
```

5. Smoke test de auth/2FA (com backend rodando externamente):

```bash
AUTH_SMOKE_USE_EXTERNAL=true AUTH_SMOKE_BASE_URL=http://localhost:3000/api npm run auth:smoke
```

4. A partir dai, deploy normal:

```bash
npm run prisma:deploy
```

## Notas

- Em `development/stage` o backend valida no boot se colunas de auth existem e se o master admin esta consistente.
- Em `production`, o bootstrap nao interrompe o boot por esse check (evita indisponibilidade), mas o processo de deploy deve executar a rotina acima.
