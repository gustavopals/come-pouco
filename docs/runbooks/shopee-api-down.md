# Runbook: Shopee API caiu ou degradou

## Sintomas

- Alerta `ComePoucoShopeeSuccessRateLow`.
- Conversoes publicas retornando fallback com mais frequencia.
- Geracao de shortlinks autenticada falhando ou lenta.
- Logs com `PUBLIC_SHOPEE_*`, erro HTTP/GraphQL da Shopee ou `SHOPEE_EMPTY_RESPONSE`.

## Confirmacao

```bash
curl -u "$METRICS_USER:$METRICS_PASSWORD" http://localhost:3000/api/metrics \
  | grep 'shopee_api_calls_total'
```

No OpenObserve, confirme:

- painel `Shopee success rate %`;
- `shopee_api_calls_total{success="false"}`;
- `shopee_api_duration_seconds_bucket` para p95/p99;
- se a falha esta em `mode="REAL"` ou tambem em `mode="MOCK"`.

No banco, confira se a falha esta concentrada em uma company/plataforma:

```sql
SELECT company_id, platform_id, mode, success, count(*) AS total
FROM api_request_logs
WHERE created_at >= now() - interval '30 minutes'
GROUP BY company_id, platform_id, mode, success
ORDER BY total DESC;
```

## Mitigacao imediata

1. Se uma plataforma especifica falhou, desative temporariamente essa credencial ou ajuste a company afetada para uma plataforma saudavel.
2. Se a Shopee estiver indisponivel para todas as credenciais, mantenha o fallback da landing ativo e registre incidente em `/admin/status`.
3. Para desenvolvimento ou demonstracao, use `SHOPEE_MOCK=true`; nao use mock como solucao silenciosa em producao sem comunicar degradacao.
4. Reduza chamadas repetidas se houver padrao de bot/rate limit.
5. Monitore o painel ate o success rate voltar acima de 80% e aguarde a notificacao `RESOLVIDO`.

## Root cause analysis

- Validar se houve rotacao de `appId`/`secret`, mudanca de `apiUrl`, troca TEST/PROD ou alteracao em `mockMode`.
- Revisar release recente nos services `shopee-integration`, `shopee-affiliate-client` e `public-conversion`.
- Separar falha externa da Shopee de erro local de assinatura/credencial.
- Registrar empresas afetadas, periodo de impacto, volume de fallback e exemplos de `requestId`.

## Comunicacao

Mensagem interna:

```text
Incidente Shopee em investigacao. Impacto: geracao de links pode usar fallback ou falhar para algumas empresas. Acao: validando taxa de sucesso por plataforma e credenciais. Proxima atualizacao em 15 minutos.
```

Mensagem de resolucao:

```text
Incidente Shopee resolvido. A geracao de links voltou ao padrao operacional. Periodo afetado: <inicio> a <fim>. Acao aplicada: <credencial ajustada/fallback monitorado/recuperacao externa>.
```
