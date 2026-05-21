# Runbook: Cache lotado

## Sintomas

- Aumento incomum de `cache_size{cache="public"}`.
- `cache_hit_ratio{cache="public"}` cai mesmo com trafego repetido.
- Conversoes publicas ficam lentas por excesso de misses.
- Admin `/api/admin/cache-stats` mostra muitas entradas ou counters crescendo fora do padrao.

## Confirmacao

```bash
curl -H "Authorization: Bearer <admin-token>" http://localhost:3000/api/admin/cache-stats
```

Metricas Prometheus:

```bash
curl -u "$METRICS_USER:$METRICS_PASSWORD" http://localhost:3000/api/metrics \
  | grep 'cache_'
```

No OpenObserve, confira:

- `cache_size{cache="public"}`;
- `cache_hit_ratio{cache="public"}`;
- volume de `cache_misses_total{cache="public"}`;
- aumento simultaneo em conversoes publicas.

## Mitigacao imediata

1. Se o cache esta consumindo memoria demais, reinicie o backend para limpar cache em memoria.
2. Se a origem e bot/abuso, ajuste rate limit publico antes de aumentar TTL/capacidade.
3. Se o problema e baixo hit ratio, reduza cardinalidade da chave ou revise normalizacao de URL.
4. Se ha muito miss por shortlinks diferentes para o mesmo produto, revise `shopee-url-parser` e expansao de shortlink.
5. Confirme recuperacao observando `cache_size` estabilizar e `cache_hit_ratio` subir.

## Root cause analysis

- Verificar se houve mudanca em `buildConversionCacheKey`, normalizacao de URL ou TTL.
- Comparar volume de `/api/public/convert` com periodo anterior.
- Avaliar se o LRU atual precisa migrar para Redis quando houver multiplas instancias.
- Registrar tamanho maximo observado, hit ratio, rota afetada e decisao de TTL/capacidade.

## Comunicacao

Mensagem interna:

```text
Cache publico degradado em investigacao. Impacto: conversoes podem ficar mais lentas e chamar Shopee com mais frequencia. Acao: validando tamanho, hit ratio e origem do trafego. Proxima atualizacao em 15 minutos.
```

Mensagem de resolucao:

```text
Cache publico normalizado. Periodo afetado: <inicio> a <fim>. Acao aplicada: <restart/rate limit/ajuste TTL/fix de chave>. Hit ratio e tamanho voltaram ao padrao esperado.
```
