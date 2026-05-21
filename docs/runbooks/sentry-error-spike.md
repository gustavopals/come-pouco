# Runbook: Sentry exception spike

## Sintomas

Alerta `ComePoucoSentryExceptionSpike`: o backend capturou mais de 10 excecoes enviadas ao Sentry em 1 hora.

## Checagem rapida

1. Abra o projeto backend no Sentry e ordene por primeiro visto/ultima ocorrencia.
2. Identifique issue dominante, release afetada e rota/contexto.
3. Correlacione `requestId`, `userId` e `companyId` com logs estruturados.
4. Veja se o erro coincide com deploy, migracao, mudanca de credenciais ou queda externa.
5. Confirme se tambem existem alertas de HTTP 5xx, DB ou Shopee.

## Mitigacao

1. Se o erro e regressao de release, faca rollback.
2. Se e dado especifico de cliente/company, isole o registro e corrija via fluxo admin ou script revisado.
3. Se e dependencia externa, reduza impacto com fallback e comunique degradacao.
4. Marque a issue no Sentry com dono e prioridade apos conter o impacto.

## Escalada

Escalar se o volume continuar subindo, se afetar rota publica de conversao ou se a causa nao for identificada em 10 minutos.
