# LGPD - modulo publico

Este documento cobre o modulo publico Alli em `/api/public/*`.

## Dados coletados

Cada tentativa de conversao grava uma linha em `Conversion` com:

| Campo                                             | Finalidade                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `companyId`                                       | Associar a conversao a empresa dona da landing publica.                  |
| `employeeId`                                      | Atribuir a conversao a um slug publico de colaborador, quando informado. |
| `originalUrl` e `normalizedUrl`                   | Converter, diagnosticar falhas e evitar duplicidade de cache.            |
| `affiliateUrl`                                    | Guardar o link afiliado gerado ou a URL de fallback.                     |
| `itemId`, `shopId`, `productName`                 | Analytics de produto e agrupamentos no dashboard.                        |
| `status`, `errorReason`, `mode`, `responseTimeMs` | Observabilidade, auditoria operacional e indicadores de qualidade.       |
| `ipHash`                                          | Hash HMAC do IP com `PUBLIC_IP_HASH_SALT`; o IP bruto nao e persistido.  |
| `userAgent`                                       | Metadado sanitizado do cliente para diagnostico e abuso.                 |
| `referrer`                                        | Origem sanitizada enviada pelo navegador, quando existir.                |

O rate limit publico tambem pode registrar eventos de abuso em `AuditLog`, como `PUBLIC_RATE_LIMIT_HIT`, com IP em formato hash.

## Base legal

O tratamento se apoia em legitimo interesse e execucao de contrato:

- Legitimo interesse: prevencao de fraude, rate limit, investigacao de abuso, observabilidade, confiabilidade e diagnostico de atribuicao afiliada.
- Execucao de contrato: conversao de links e atribuicao a empresa ou colaborador quando a landing publica foi configurada pelo responsavel.

O modulo nao deve receber dados pessoais sensiveis. URLs enviadas devem ser URLs de produto Shopee; clientes nao devem incluir dados pessoais em query strings.

## Retencao

`CONVERSION_RETENTION_DAYS` controla a janela de retencao dos metadados pessoais de conversao. O default e `180` dias.

O job `conversion-retention.job.ts` roda diariamente as `03:30` no horario do servidor e anonimiza conversoes mais antigas que a janela configurada:

- `ipHash` vira string vazia.
- `userAgent` vira string vazia.
- `referrer` vira `null`.

O endpoint admin `DELETE /api/admin/conversions/anonymize?olderThan=YYYY-MM-DD` executa a mesma anonimização sob demanda.

As linhas de conversao nao sao apagadas por padrao porque metricas agregadas dependem de historico de status, produto e atribuicao. Se uma solicitacao exigir apagamento ou anonimização adicional, a operacao deve ser escopada por empresa/data e revisada para nao expor dados de outros tenants.

## Direitos do titular

- Confirmacao/acesso: responder apenas quando houver chave confiavel de correlacao; `ipHash` nao e reversivel.
- Correcao: dados de conversao sao eventos historicos; correcao deve ser excecao documentada.
- Anonimizacao/eliminacao: usar o endpoint admin ou operacao de banco escopada apos verificacao do pedido.
- Portabilidade: exportar somente campos pertinentes ao pedido verificado, sem segredos internos, hashes brutos ou dados de outro tenant.
- Oposicao/revogacao: desativar landing publica, trocar slugs, ajustar limites ou remover o ponto publico quando aplicavel.

## Observabilidade

Logs do fluxo publico usam prefixo `[public-convert]` e JSON estruturado com `requestId`, `conversionId`, `companySlug`, `employeeSlug`, `status`, `mode`, `cacheHit` e `responseTimeMs`.

Admins podem consultar `GET /api/admin/metrics/public-module` para cache hit ratio, conversoes por minuto, fallback ratio e contagens de status das ultimas 24h.
