# Status Page Interna

A Fase 6.7 adiciona uma pagina interna para admins em:

```text
/admin/status
```

## O que a tela mostra

- Estado atual de Backend, Database, Shopee API, Email Transport e Cache.
- Timeline dos ultimos 7 dias com marcadores de incidentes.
- Lista de incidentes recentes com titulo, severidade, status, componentes afetados e timestamps.
- Formulario manual "Reportar incidente".

## Endpoints

Todos os endpoints ficam sob `/api/admin` e exigem usuario `ADMIN`.

```text
GET    /api/admin/status
GET    /api/admin/incidents
POST   /api/admin/incidents
GET    /api/admin/incidents/:id
PATCH  /api/admin/incidents/:id
DELETE /api/admin/incidents/:id
```

`GET /api/admin/status` executa o readiness check da Task 6.3 e combina esse estado com incidentes ativos. Incidente ativo sobre um componente operacional marca o componente como `degraded`; incidente `critical` marca como `down`.

## Payload de incidente

```json
{
  "title": "Shopee instavel",
  "description": "Falhas intermitentes ao gerar shortlinks.",
  "severity": "high",
  "status": "investigating",
  "affectedComponents": ["shopee"],
  "startedAt": "2026-05-21T12:00:00.000Z"
}
```

Valores aceitos:

- `severity`: `low`, `medium`, `high`, `critical`
- `status`: `investigating`, `identified`, `resolved`
- `affectedComponents`: `backend`, `database`, `shopee`, `email`, `cache`

Ao atualizar um incidente para `resolved` sem `resolvedAt`, o backend usa o horario atual.
