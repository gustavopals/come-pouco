# Alerting

A Fase 6 usa Prometheus para avaliar regras e Alertmanager para entregar notificacoes no Discord. OpenObserve segue como dashboard unico.

## Canal

Canal padrao: Discord `#alerts`.

1. Crie um webhook no canal.
2. Salve a URL em um arquivo secreto fora do repo, por exemplo `/var/secrets/come-pouco/discord_webhook_url`.
3. Configure a stack com:

```bash
ALERT_DISCORD_WEBHOOK_FILE=/var/secrets/come-pouco/discord_webhook_url
```

Em desenvolvimento, `infra/openobserve/.env.example` aponta para `infra/alertmanager/secrets/discord_webhook_url.example`, que e apenas um placeholder valido para parse de config.

## Regras

As regras ficam em `infra/prometheus/alerts.yml`.

| Alerta                            | Condicao                           | Severidade | Runbook                                     |
| --------------------------------- | ---------------------------------- | ---------- | ------------------------------------------- |
| `ComePoucoHighErrorRate`          | HTTP 5xx > 5% em 5min              | high       | `docs/runbooks/erro-500-em-pico.md`         |
| `ComePoucoShopeeSuccessRateLow`   | Shopee success rate < 80% em 10min | high       | `docs/runbooks/shopee-api-down.md`          |
| `ComePoucoBackendHealthcheckDown` | `/api/health` falha por 1min       | critical   | `docs/runbooks/backend-healthcheck-down.md` |
| `ComePoucoDatabaseLatencyHigh`    | p95 do check DB > 500ms em 5min    | medium     | `docs/runbooks/db-lento.md`                 |
| `ComePoucoSentryExceptionSpike`   | Sentry backend > 10 excecoes em 1h | medium     | `docs/runbooks/erro-500-em-pico.md`         |

## Throttle e resolucao

`infra/alertmanager/alertmanager.yml` define:

- `group_wait: 30s`
- `group_interval: 5m`
- `repeat_interval: 15m`
- `send_resolved: true`

Isso evita repeticao excessiva e manda a mensagem de recuperacao quando a condicao deixa de disparar.

## Sentry

O alerta versionado usa a metrica `sentry_events_total` incrementada quando o backend envia excecoes ao Sentry. Isso mantem o roteamento em um unico Alertmanager. Se a equipe quiser a semantica exata de "nova issue/fingerprint com mais de 10 ocorrencias", cadastre tambem uma Issue Alert no Sentry usando o mesmo webhook Discord e o runbook `docs/runbooks/erro-500-em-pico.md`.

## Testes manuais

- Backend offline: pare o backend por mais de 1 minuto e verifique `ComePoucoBackendHealthcheckDown`.
- Error rate: force uma rota a responder 500 repetidas vezes em ambiente de dev.
- Shopee: simule falha na integracao real ou aponte temporariamente a URL para um endpoint invalido.
- DB latency: use uma rede lenta/DB saturado em dev ou reduza temporariamente o limite da regra para validar roteamento.
- Sentry: dispare mais de 10 excecoes capturadas pelo backend em 1h.

Depois de qualquer ajuste em `alerts.yml`, recarregue o Prometheus:

```bash
curl -X POST http://localhost:9090/-/reload
```

Depois de qualquer ajuste no Alertmanager, reinicie a stack ou o servico:

```bash
docker compose -f docker-compose.observability.yml --env-file infra/openobserve/.env.example restart alertmanager
```
