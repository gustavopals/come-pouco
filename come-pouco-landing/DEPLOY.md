# Deploy — Come Pouco Landing (Coolify)

> Alvo: subir `come-pouco-landing` como nova aplicação no Coolify, ao lado do backend e do frontend já existentes em `Projeto Come Pouco / production`. URL final: **https://landing.palsincomehub.com**.
>
> Modo: build via **Dockerfile** + auto-deploy a cada push em `main`.

## Pré-requisitos (verificar antes de começar)

- [ ] Subdomínio `landing.palsincomehub.com` apontado para o IP do servidor Coolify (registro A ou CNAME).
- [ ] Backend já está rodando em `api.auralinks.com.br` (✅ confirmado no print).
- [ ] Acesso ao Coolify em `app.palsincomehub.com` com permissão sobre o projeto "Projeto Come Pouco".
- [ ] PR com o código da Fase 4 mergeado em `main` no repositório `gustavopals/come-pouco`.

## 1. Atualizar backend (1 vez só — pré-deploy da landing)

A landing chama `POST /api/public/leads`. O backend já tem a rota, mas precisa de:

### 1.1. Aplicar a migration `Lead`

A migration foi pré-gerada em `come-pouco-backend/prisma/migrations/202605211400_add_lead_model/`. O backend rodará `prisma migrate deploy` automaticamente no boot (script `start:prod`), então **basta redeployar o backend** após o merge — não há ação manual.

### 1.2. Atualizar variáveis de ambiente do backend no Coolify

No painel da app `gustavopals/come-pouco:main-backend` → **Environment Variables**, adicionar/atualizar:

| Variável              | Valor                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_CORS_ORIGINS` | adicione `https://landing.palsincomehub.com` ao final da lista existente (separado por vírgula).                                    |
| `LEAD_NOTIFY_EMAIL`   | email que receberá notificações de leads. Sugestão: `contato@palsincomehub.com`. Se omitido, default é `contato@come-pouco.com.br`. |

Salvar → Coolify oferece um botão "Restart" para aplicar as envs sem rebuild.

### 1.3. Validar smoke do endpoint público

Depois do redeploy:

```bash
curl -s -i -X POST https://api.auralinks.com.br/api/public/leads \
  -H 'Content-Type: application/json' \
  -d '{"name":"Teste deploy","email":"deploy-test@example.com"}'
```

Esperado: `201 Created` + `{"ok":true,"id":<n>}`. Se vier 4xx/5xx, inspecionar logs antes de seguir.

## 2. Criar a aplicação `landing` no Coolify

### 2.1. New resource

No projeto `Projeto Come Pouco / production`:

1. Clicar em **+ New** → **Public Repository** (ou **Private Repository** se for o caso do `gustavopals/come-pouco`).
2. Repositório: `https://github.com/gustavopals/come-pouco` (mesmo do backend/frontend).
3. Branch: `main`.
4. **Base Directory**: `come-pouco-landing` ← importante, é monorepo.
5. **Build Pack**: `Dockerfile`.
6. **Dockerfile location**: `Dockerfile` (default).

### 2.2. Configuração geral

| Campo                  | Valor                                                 |
| ---------------------- | ----------------------------------------------------- |
| Name                   | `come-pouco-landing`                                  |
| Description (opcional) | Landing institucional da Fase 4 (Astro + Tailwind v4) |
| Port (Ports Exposes)   | `80`                                                  |
| Domain                 | `https://landing.palsincomehub.com`                   |
| Health check path      | `/`                                                   |

Coolify roda Traefik na frente, então TLS é automático (Let's Encrypt) se o DNS já estiver apontando.

### 2.3. Build args (importante — Astro embute as URLs no HTML)

Em **Build Variables** (não confundir com Environment Variables — esses são consumidos só durante o `docker build`, mas o Dockerfile copia eles pra `ENV` antes do `npm run build`):

| Build arg                 | Valor                                                    |
| ------------------------- | -------------------------------------------------------- |
| `PUBLIC_SITE_URL`         | `https://landing.palsincomehub.com`                      |
| `PUBLIC_APP_URL`          | `https://app.auralinks.com.br`                           |
| `PUBLIC_LEAD_API_URL`     | `https://api.auralinks.com.br/api/public/leads`          |
| `PUBLIC_PLAUSIBLE_DOMAIN` | (vazio por enquanto — preencher quando ativar analytics) |
| `PUBLIC_ANALYTICS_SCRIPT` | (vazio por enquanto)                                     |

> ⚠️ Se você esquecer de configurar `PUBLIC_APP_URL` e `PUBLIC_LEAD_API_URL` no build, os CTAs e o form de lead podem apontar para URLs incorretas. Os defaults do Dockerfile já usam `app.auralinks.com.br` e `api.auralinks.com.br`.

### 2.4. Runtime envs (opcional)

A landing é estática — não precisa de envs em runtime. Mas se você adicionar Sentry depois:

| Variável                            | Valor                            |
| ----------------------------------- | -------------------------------- |
| `SENTRY_DSN_LANDING`                | DSN do projeto Sentry da landing |
| `SENTRY_ENVIRONMENT`                | `production`                     |
| `SENTRY_TRACES_SAMPLE_RATE_LANDING` | `0.1`                            |

Essas só precisam estar em build time (porque Sentry SDK também é client-side), então cole-as também como **Build args** se for ativar.

### 2.5. Deploy

1. Clicar em **Deploy**.
2. Coolify clona, roda `docker build` (stage 1: Node 22 + `npm ci` + `npm run build`; stage 2: nginx alpine + copy do `dist/`).
3. Build esperado: ~2-3 min na primeira vez (cache vazio), ~30s nas subsequentes.

### 2.6. Auto-deploy em push (recomendado)

Em **Webhooks** da app no Coolify → habilitar **Auto deploy on push** e copiar o webhook URL. Adicionar como webhook no GitHub do repo (Settings → Webhooks). A partir daí, qualquer merge em `main` que toque `come-pouco-landing/**` redeploya sozinho.

## 3. Validar pós-deploy

```bash
# 1. HTTP 200 na home
curl -sI https://landing.palsincomehub.com/ | head -5

# 2. Sitemap acessível
curl -s https://landing.palsincomehub.com/sitemap-index.xml | head -3

# 3. robots.txt correto
curl -s https://landing.palsincomehub.com/robots.txt

# 4. /dev/components redireciona pra 404
curl -sI https://landing.palsincomehub.com/dev/components/ | head -5

# 5. Submit de teste no form de lead (vai bater no backend)
curl -s -i -X POST https://api.auralinks.com.br/api/public/leads \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://landing.palsincomehub.com' \
  -d '{"name":"Smoke deploy","email":"smoke@example.com","volume":"ate-500","message":"teste pós-deploy"}'
```

Esperado:

1. HTTP/2 200, content-type text/html
2. XML válido com a URL canônica
3. `Sitemap: https://landing.palsincomehub.com/sitemap-index.xml`
4. HTTP 200 (redirect HTML interno, não 404 real — é meta-refresh + noindex)
5. HTTP 201 `{"ok":true,"id":N}`

## 4. Rollback

Se algo der ruim:

- **Rollback rápido**: no Coolify, página da app → **Deployments** → clicar no deploy anterior → **Redeploy**.
- **Rollback do código**: revert do commit no Git → push → auto-deploy.
- **Pausar serviço**: botão **Stop** na app. Não toca em build artefatos, só desliga o container.

A landing é estática (zero estado), então rollback nunca perde dados. O backend é a única coisa com persistência — a migration `Lead` é additive (nova tabela), então rollback de código sem rollback de schema é seguro (campos extras no banco não afetam nada).

## 5. Pendências fora deste deploy

- `apple-touch-icon.png` 180×180 — referenciada em `<link rel="apple-touch-icon">` e `manifest.json`. Browsers ignoram 404 mas é cosmético resolver.
- `og:image` ainda aponta pra `default.svg` — Facebook/LinkedIn preferem PNG/JPG. Trocar antes do hard launch.
- Páginas legais (`/sobre`, `/privacidade`, `/termos`, `/lgpd`, `/blog`) estão linkadas no footer mas ainda não existem.

Tudo listado em `docs/launch-checklist.md`.
