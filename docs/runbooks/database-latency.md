# Runbook: DB latency alta

## Sintomas

Alerta `ComePoucoDatabaseLatencyHigh`: p95 do check de banco ficou acima de 500ms por 5 minutos.

## Checagem rapida

1. Abra o painel DB health latency no OpenObserve.
2. Verifique logs de slow query do Prisma.
3. Confira conexoes ativas, CPU, memoria e I/O do Postgres.
4. Veja se algum job de limpeza, migracao ou consulta administrativa esta rodando.
5. Confirme se a latencia vem do banco ou da rede entre backend e Postgres.

## Mitigacao

1. Interrompa consultas/job claramente abusivos em ambiente de desenvolvimento.
2. Se for saturacao, reduza trafego ou aumente recursos do Postgres.
3. Se uma query nova causou regressao, rollback do deploy ou adicione indice em hot path.
4. Rode `EXPLAIN ANALYZE` fora do horario critico antes de aplicar mudancas estruturais.

## Escalada

Escalar se login, dashboard ou conversao publica estiverem lentos/degradados por mais de 15 minutos.
