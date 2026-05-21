# Runbook: HTTP 5xx alto

## Sintomas

Alerta `ComePoucoHighErrorRate`: mais de 5% das requisicoes terminaram em HTTP 5xx nos ultimos 5 minutos.

## Checagem rapida

1. Abra o dashboard "Come Pouco - Saude" e confirme quais rotas aparecem no painel Top 10 errors.
2. Consulte o Sentry pelo `requestId` ou pelo horario do alerta.
3. Verifique logs do backend filtrando `level=error` e `eventType`.
4. Confira se houve deploy recente, migracao pendente ou queda do banco.

## Mitigacao

1. Se o erro comecou apos deploy, faca rollback do backend.
2. Se o erro depende da Shopee, habilite modo mock apenas para desenvolvimento ou comunique degradacao operacional.
3. Se for DB/schema, rode `npm --prefix come-pouco-backend run prisma:deploy` no ambiente correto.
4. Monitore a queda do `error rate` e aguarde notificacao de resolucao.

## Escalada

Escalar se o erro persistir por mais de 15 minutos, afetar login/conversao publica ou envolver perda de dados.
