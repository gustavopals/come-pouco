# Health Checks

O backend expoe dois endpoints publicos de saude:

- `GET /api/health`: liveness simples. Nao consulta banco nem dependencias externas.
- `GET /api/health/ready`: readiness aprofundada. Consulta DB, Shopee opcional, email config e cache.

## Liveness

`/api/health` deve responder `200` enquanto o processo Node estiver vivo:

```json
{
  "status": "ok",
  "uptime": 12345,
  "version": "1.0.0",
  "timestamp": "2026-05-21T12:00:00.000Z"
}
```

Use esse endpoint para healthcheck de processo ou restart automatico simples.

## Readiness

`/api/health/ready` executa checks em paralelo e retorna:

```json
{
  "status": "ok",
  "checks": {
    "database": { "status": "ok", "latencyMs": 12 },
    "shopee": { "status": "ok", "skipped": true, "message": "check desabilitado" },
    "email": { "status": "degraded", "message": "transporte de email desabilitado" },
    "cache": {
      "status": "ok",
      "details": { "hits": 10, "misses": 2, "size": 5, "hitRatio": 0.8333 }
    }
  },
  "uptime": 12345,
  "version": "1.0.0",
  "timestamp": "2026-05-21T12:00:00.000Z"
}
```

HTTP status:

- `200` quando `status` for `ok`.
- `200` quando `status` for `degraded`, para nao derrubar load balancer por dependencia parcial.
- `503` quando `status` for `down`, atualmente reservado para falha de banco.

## Checks

Database:

- Executa `SELECT 1` via Prisma.
- `ok` se responder ate `HEALTH_DB_LATENCY_WARN_MS`.
- `degraded` se responder acima do limite.
- `down` se a query falhar.

Shopee:

- Desabilitado por padrao para evitar chamadas externas em todo probe.
- Quando habilitado, faz `HEAD` em `HEALTH_SHOPEE_URL` com timeout curto.
- Falhas ou HTTP `5xx` degradam a readiness, mas nao retornam `503`.

Email:

- Carrega a config ativa em `SystemEmailConfig`.
- Nao envia email real.
- Retorna `degraded` se o transporte estiver desabilitado, provider for invalido ou campos obrigatorios estiverem faltando.
- Nao expõe secrets na resposta.

Cache:

- Reporta stats do cache publico em memoria: `hits`, `misses`, `size`, `hitRatio`.

## Variaveis

```bash
APP_VERSION=1.0.0
HEALTH_DB_LATENCY_WARN_MS=100
HEALTH_SHOPEE_ENABLED=false
HEALTH_SHOPEE_URL=https://open-api.affiliate.shopee.com.br/graphql
HEALTH_SHOPEE_TIMEOUT_MS=3000
```

`APP_VERSION` pode ser substituido por `SENTRY_RELEASE`, `COMMIT_SHA` ou `GIT_SHA` quando o pipeline injeta o SHA da build.
