# Runbook: Shopee success rate baixo

## Sintomas

Alerta `ComePoucoShopeeSuccessRateLow`: menos de 80% das chamadas Shopee tiveram sucesso na janela de 10 minutos.

## Checagem rapida

1. Verifique o painel Shopee success rate no OpenObserve.
2. Confira logs com `eventType` relacionado a geracao de shortlink.
3. Veja se a falha esta concentrada em uma company/plataforma ou em todas.
4. Valide credenciais da plataforma: `appId`, `secret`, `apiUrl`, modo TEST/PROD e `mockMode`.
5. Verifique status externo da Shopee e erros HTTP/GraphQL retornados.

## Mitigacao

1. Se credencial especifica falhou, desative temporariamente a plataforma ou ajuste a company afetada.
2. Se for indisponibilidade geral da Shopee, mantenha fallback ativo e comunique degradacao.
3. Se for rate limit, reduza trafego automatizado e investigue abuso/bots.
4. Confirme recuperacao no painel e espere notificacao `RESOLVIDO`.

## Escalada

Escalar se conversoes publicas estiverem falhando em massa ou se clientes pagantes estiverem sem fallback valido.
