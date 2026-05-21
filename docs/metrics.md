# Metrics

O backend expoe metricas Prometheus em:

```text
GET /api/metrics
```

O endpoint e protegido por Basic Auth.

## Configuracao

```bash
METRICS_USER=prometheus
METRICS_PASSWORD=troque-por-uma-senha-forte
```

Em desenvolvimento, se as variaveis nao forem informadas, o backend usa:

```bash
METRICS_USER=metrics
METRICS_PASSWORD=metrics-dev-change-me
```

Em producao, sem `METRICS_USER` e `METRICS_PASSWORD`, o endpoint responde `503 METRICS_NOT_CONFIGURED`.

Exemplo:

```bash
curl -u "$METRICS_USER:$METRICS_PASSWORD" http://localhost:3000/api/metrics
```

## HTTP

- `http_requests_total{method,route,status}`
- `http_request_duration_seconds{method,route,status}`

`route` usa o template do Express, por exemplo `/api/users/:id`, para evitar cardinalidade alta.

## Shopee

- `shopee_api_calls_total{mode,success}`
- `shopee_api_duration_seconds{mode,success}`

Labels:

- `mode`: `MOCK` ou `REAL`
- `success`: `true` ou `false`

## Conversoes

- `conversions_total{status}`

Labels:

- `SUCCESS`
- `FALLBACK`
- `ERROR`
- `BOT_DETECTED`

A metrica e incrementada quando a conversao publica e persistida com sucesso.

## Auth

- `auth_attempts_total{result}`
- `active_users{window}`

Resultados atuais:

- `login_success`
- `login_2fa_required`
- `login_failure`
- `login_locked`
- `2fa_success`
- `2fa_failure`
- `2fa_locked`
- `forgot_password_requested`
- `reset_password_success`
- `reset_password_failure`

## Cache

- `cache_hits_total{cache}`
- `cache_misses_total{cache}`
- `cache_size{cache}`
- `cache_hit_ratio{cache}`

Hoje o label `cache` usa `public`.

## DB Health

- `db_health_latency_seconds`

Atualizada quando `/api/health/ready` executa o check de banco.

## Sentry

- `sentry_events_total{surface,event_type}`

Incrementada quando o backend captura uma excecao e encaminha para o Sentry. Hoje os labels usados sao `surface="backend"` e `event_type="exception"`.

## Node.js

`prom-client` tambem coleta metricas default `nodejs_*`, incluindo memoria, CPU, event loop e GC.
