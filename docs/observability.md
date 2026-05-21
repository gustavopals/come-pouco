# Observability

A stack escolhida para a Fase 6 e OpenObserve self-hosted com Prometheus fazendo scrape do backend e enviando metricas via `remote_write`.

## Arquivos

- `docker-compose.observability.yml`: sobe OpenObserve e Prometheus.
- `infra/openobserve/prometheus.yml`: scrape de `/api/metrics` e `remote_write` para OpenObserve.
- `infra/openobserve/.env.example`: valores locais de referencia.
- `infra/dashboards/come-pouco-saude.openobserve.json`: dashboard "Come Pouco - Saude".
- `infra/prometheus/alerts.yml`: 5 alertas criticos avaliados pelo Prometheus.
- `infra/alertmanager/alertmanager.yml`: roteamento para Discord, throttle e resolved notifications.
- `infra/blackbox/blackbox.yml`: sondas HTTP de `/api/health` e `/api/health/ready`.
- `docs/status-page.md`: guia da status page interna e endpoints de incidentes.

## Subir localmente

1. Rode o backend em `localhost:3000`.
2. Garanta que o backend aceita as credenciais locais de metricas:

```bash
METRICS_USER=metrics
METRICS_PASSWORD=metrics-dev-change-me
```

3. Suba a stack:

```bash
npm run obs:up
```

4. Acesse:

- OpenObserve: `http://localhost:5080`
- Prometheus: `http://localhost:9090`
- Alertmanager: `http://localhost:9093`
- Blackbox exporter: `http://localhost:9115`

Credenciais locais do OpenObserve:

```text
root@example.com / Complexpass#123
```

Essas credenciais sao apenas para desenvolvimento. Em producao, troque antes do primeiro start do volume.

## Fluxo de metricas

```text
backend /api/metrics
  -> Prometheus scrape com Basic Auth
  -> OpenObserve remote_write
  -> Dashboard OpenObserve

backend /api/health e /api/health/ready
  -> Blackbox exporter
  -> Prometheus alert rules
  -> Alertmanager
  -> Discord #alerts
```

O Prometheus local usa `host.docker.internal:3000` como alvo para o backend. Em Linux, o compose inclui `host-gateway`.

## Importar dashboard

1. Entre no OpenObserve.
2. Va em `Dashboards`.
3. Clique em `Import`.
4. Selecione `infra/dashboards/come-pouco-saude.openobserve.json`.
5. Confirme o import.

O dashboard usa PromQL e espera as metricas criadas na Task 6.4:

- `http_requests_total`
- `http_request_duration_seconds_bucket`
- `shopee_api_calls_total`
- `conversions_total`
- `auth_attempts_total`
- `cache_hit_ratio`
- `db_health_latency_seconds`
- `active_users`
- `sentry_events_total`
- `nodejs_eventloop_lag_seconds`

## Paineis

- Requests/min
- Error rate %
- Latency p50/p95/p99
- Shopee success rate %
- Conversoes/h por status
- Auth attempts/min
- Top 10 errors por rota/status
- Event loop lag
- DB health latency
- Cache hit ratio %
- Active users

## Producao/Coolify

Use `docker-compose.observability.yml` como base da stack de observabilidade. Antes de subir:

1. Troque `OPENOBSERVE_ROOT_USER_EMAIL` e `OPENOBSERVE_ROOT_USER_PASSWORD`.
2. Ajuste `infra/openobserve/prometheus.yml`:
   - `scrape_configs[].static_configs[].targets` para o host interno do backend.
   - `scrape_configs[].basic_auth` para `METRICS_USER`/`METRICS_PASSWORD` reais.
   - `remote_write[].url` para a URL interna do OpenObserve e org correta.
   - `remote_write[].basic_auth` para o usuario OpenObserve correto.
3. Crie o webhook Discord do canal `#alerts` e salve a URL em um arquivo secreto fora do repo.
4. Aponte `ALERT_DISCORD_WEBHOOK_FILE` para esse arquivo secreto.
5. Ajuste os `dashboard_url` em `infra/prometheus/alerts.yml` para a URL publica/interna correta do OpenObserve.
6. Mantenha `defaultDatetimeDuration.relativeTimePeriod` do dashboard em `24h`, salvo necessidade operacional diferente.

## Alertas

Os alertas versionados ficam em `infra/prometheus/alerts.yml` e sao enviados pelo Alertmanager. O `repeat_interval: 15m` limita repeticoes do mesmo alerta, e `send_resolved: true` envia a notificacao de recuperacao.

Regras configuradas:

- `ComePoucoHighErrorRate`: HTTP 5xx > 5% em 5min.
- `ComePoucoShopeeSuccessRateLow`: sucesso Shopee < 80% em 10min.
- `ComePoucoBackendHealthcheckDown`: liveness indisponivel por 1min.
- `ComePoucoDatabaseLatencyHigh`: p95 do check DB > 500ms em 5min.
- `ComePoucoSentryExceptionSpike`: mais de 10 excecoes backend capturadas pelo Sentry em 1h.

Detalhes operacionais ficam em `docs/alerting.md`.

## Status page interna

Admins acessam `/admin/status` no frontend. A tela consome `GET /api/admin/status`, mostra os componentes do readiness check e cruza esse estado com incidentes ativos da tabela `incidents`.

Incidentes podem ser criados manualmente pela tela ou via API `POST /api/admin/incidents`. O historico operacional e documentado em `docs/status-page.md`.

## Runbooks

Os runbooks operacionais ficam em `docs/runbooks/`.

- `shopee-api-down.md`
- `db-lento.md`
- `erro-500-em-pico.md`
- `email-nao-envia.md`
- `cache-lotado.md`

Use `_template.md` para novos cenarios e `_postmortem-template.md` apos incidentes reais.

## Encerrar

```bash
npm run obs:down
```

Para ver logs:

```bash
npm run obs:logs
```
