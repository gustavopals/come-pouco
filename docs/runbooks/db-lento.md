# Runbook: DB lento

## Sintomas

- Alerta `ComePoucoDatabaseLatencyHigh`.
- `/api/health/ready` retorna `database.status=degraded` ou latencia alta.
- Login, dashboard, listagens paginadas ou conversao publica ficam lentos.
- Logs do Prisma mostram slow queries ou aumento de `responseTimeMs`.

## Confirmacao

```bash
curl http://localhost:3000/api/health/ready | jq '.checks.database'
```

Consultas de leitura no Postgres:

```sql
SELECT state, count(*)
FROM pg_stat_activity
GROUP BY state
ORDER BY count DESC;

SELECT pid, state, now() - query_start AS duration, left(query, 180) AS query
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY duration DESC
LIMIT 10;
```

Se `pg_stat_statements` estiver habilitado:

```sql
SELECT calls, mean_exec_time, max_exec_time, rows, left(query, 180) AS query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Mitigacao imediata

1. Identifique se ha job de limpeza, migracao ou consulta administrativa rodando no horario do alerta.
2. Interrompa apenas consultas claramente travadas e de baixo risco em ambiente de desenvolvimento.
3. Se a lentidao veio apos deploy, faca rollback da release que introduziu a query.
4. Se o gargalo e volume, reduza trafego administrativo pesado e aumente recursos do Postgres.
5. Confirme queda de `db_health_latency_seconds` e melhoria nos tempos das rotas.

## Root cause analysis

- Rodar `EXPLAIN ANALYZE` em queries suspeitas fora do periodo critico.
- Verificar ausencia de indices nos filtros novos, especialmente `companyId`, `createdAt`, `status`, `userId` e joins de dashboard.
- Revisar se paginacao esta usando `limit` adequado e se nao houve busca sem filtro.
- Registrar query, plano, volume de linhas, indice aplicado e mudanca corretiva.

## Comunicacao

Mensagem interna:

```text
Incidente de latencia no banco em investigacao. Impacto: rotas autenticadas e dashboards podem responder lentamente. Acao: revisando queries ativas e recursos do Postgres. Proxima atualizacao em 15 minutos.
```

Mensagem de resolucao:

```text
Incidente de latencia no banco resolvido. Periodo afetado: <inicio> a <fim>. Acao aplicada: <rollback/indice/recurso/job pausado>. Monitoramento mantido por 30 minutos.
```
