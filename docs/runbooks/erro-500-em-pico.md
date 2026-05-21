# Runbook: Erro 500 em pico

## Sintomas

- Alerta `ComePoucoHighErrorRate`.
- Aumento de issues no Sentry ou alerta `ComePoucoSentryExceptionSpike`.
- Usuarios recebem `INTERNAL_ERROR` com `requestId`.
- Top errors no OpenObserve mostra uma rota concentrando HTTP 5xx.

## Confirmacao

No OpenObserve, veja:

- painel `Error rate %`;
- tabela `Top 10 errors`;
- latencia p95/p99 no mesmo intervalo.

Use o `requestId` retornado para cruzar logs e Sentry:

```bash
# Exemplo conceitual: ajuste ao coletor/log viewer do ambiente.
grep '<requestId>' /var/log/come-pouco/backend.log
```

Cheque deploy/migration:

```bash
git log --oneline -5
npm --prefix come-pouco-backend run prisma:deploy
```

## Mitigacao imediata

1. Se o pico comecou apos deploy, faca rollback do backend.
2. Se a falha e schema/migration, aplique migrations pendentes no banco correto.
3. Se o erro esta isolado em integracao externa, mantenha fallback e comunique degradacao.
4. Se uma rota publica esta sob abuso, reduza limite/rate limit e registre o incidente.
5. Confirme queda do error rate abaixo de 5% por pelo menos 10 minutos.

## Root cause analysis

- Identificar a primeira release afetada e a primeira issue no Sentry.
- Separar erro de codigo, erro de dados, indisponibilidade externa e erro de schema.
- Adicionar teste unitario/integracao para o fluxo que gerou o 500.
- Registrar `requestId`, rota, payload sanitizado, empresa afetada, release e fix aplicado.

## Comunicacao

Mensagem interna:

```text
Pico de erro 500 em investigacao. Impacto: <rota/fluxo> pode falhar para <escopo>. Acao: correlacionando Sentry, logs e deploy recente. Proxima atualizacao em 10 minutos.
```

Mensagem de resolucao:

```text
Pico de erro 500 resolvido. Impacto: <rota/fluxo>. Periodo afetado: <inicio> a <fim>. Acao aplicada: <rollback/fix/migration/fallback>. Vamos acompanhar o error rate por mais 30 minutos.
```
