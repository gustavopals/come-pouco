# Runbook: Backend healthcheck down

## Sintomas

Alerta `ComePoucoBackendHealthcheckDown`: `/api/health` nao respondeu HTTP 200 por mais de 1 minuto.

## Checagem rapida

1. Acesse `/api/health` direto pelo host do ambiente.
2. Verifique se o container/processo do backend esta em execucao.
3. Confira logs de boot por falha de DB, env obrigatoria ausente ou migracao pendente.
4. Verifique CPU/memoria do host e reinicios frequentes.
5. Confirme se o Prometheus ainda consegue resolver o host alvo configurado.

## Mitigacao

1. Reinicie o backend se o processo travou.
2. Se o boot falha por schema, aplique migrations no banco correto.
3. Se ha erro de env, corrija a variavel e reinicie.
4. Se o host esta sem recurso, reduza carga ou escale o servico.

## Escalada

Escalar imediatamente se o backend continua offline apos reinicio ou se tambem houver alerta de DB.
