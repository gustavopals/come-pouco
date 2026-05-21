# Runbook: <cenario>

## Sintomas

- O que o usuario percebe.
- O que o alerta reporta.
- Quais rotas, componentes ou empresas costumam ser afetados.

## Confirmacao

```bash
# Comandos ou consultas de leitura para confirmar o diagnostico.
```

Verifique tambem:

- Dashboard "Come Pouco - Saude" no OpenObserve.
- Sentry, filtrando por release, rota e `requestId`.
- Logs estruturados do backend, filtrando `level`, `eventType`, `requestId`, `companyId` e `userId`.

## Mitigacao imediata

1. Passo minimo para reduzir impacto.
2. Passo para restaurar fluxo principal.
3. Passo para confirmar recuperacao.

## Root cause analysis

- Mudanca recente de deploy, migracao, configuracao ou credencial.
- Query, dependencia externa, volume anormal ou regressao de codigo.
- Evidencia que deve ir para o incidente ou post-mortem.

## Comunicacao

Mensagem interna:

```text
Incidente em investigacao: <resumo>. Impacto: <rotas/clientes>. Acao em andamento: <acao>. Proxima atualizacao: <horario>.
```

Mensagem de resolucao:

```text
Incidente resolvido: <resumo>. Inicio: <horario>. Fim: <horario>. Acao aplicada: <acao>. Acompanhamento: <link do incidente/post-mortem>.
```
