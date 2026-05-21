# Checklist de lancamento - modulo publico Alli

Use este checklist para homologacao, piloto e deploy em producao.

## Antes do deploy

- [ ] Migrations aplicadas no ambiente alvo: `npm --prefix come-pouco-backend run prisma:deploy`.
- [ ] `PUBLIC_IP_HASH_SALT` definido com valor forte e diferente de desenvolvimento.
- [ ] `CONVERSION_RETENTION_DAYS` definido ou aceito no default `180`.
- [ ] `PUBLIC_CORS_ORIGINS` contem os dominios publicos da app.
- [ ] `PUBLIC_APP_URL` aponta para o frontend correto.
- [ ] Shopee `PurchasePlatform` piloto configurada em `TEST` ou `PROD` conforme o objetivo do dry-run.
- [ ] `fallbackAffiliateUrl` da empresa piloto definida com URL Shopee valida.
- [ ] Landing da empresa piloto ativa (`LandingConfig.isActive=true`).
- [ ] Slug da empresa piloto validado em `GET /api/public/landing/:slug`.
- [ ] Slugs de colaboradores piloto definidos quando houver atribuicao individual.

## Testes automatizados

- [ ] `npm --prefix come-pouco-backend run build`.
- [ ] `npm --prefix come-pouco-backend run test`.
- [ ] `npm --prefix come-pouco-frontend run build`.
- [ ] `npm --prefix come-pouco-frontend test -- --watch=false`.
- [ ] `npm run e2e:list`.
- [ ] `npm run e2e` em ambiente com Docker/Postgres/Mailpit disponiveis.
- [ ] `npm run smoke:postdeploy` contra homologacao.

## Dry-run com empresa piloto

- [ ] Criar ou selecionar uma empresa de baixo trafego.
- [ ] Confirmar plataforma Shopee real quando o dry-run exigir conversao real.
- [ ] Configurar slug publico da empresa.
- [ ] Configurar landing e fallback.
- [ ] Abrir `/p/<companySlug>` em dispositivo mobile real.
- [ ] Colar uma URL Shopee longa real e confirmar redirecionamento.
- [ ] Colar um shortlink `shope.ee` real e confirmar expansao/conversao.
- [ ] Confirmar uma linha `Conversion` com `status=SUCCESS`.
- [ ] Confirmar que o dashboard de conversoes reflete a tentativa.
- [ ] Guardar `requestId`, `conversionId`, horario e screenshot do resultado.

## Pos-deploy

- [ ] `GET /api/public/healthz` retorna 200.
- [ ] `GET /api/public/landing/<slug-piloto>` retorna 200 com `Cache-Control`.
- [ ] `POST /api/public/convert` mockado via `smoke:postdeploy` retorna `success`.
- [ ] Logs `[public-convert]` chegam no coletor com `requestId`, `companySlug`, `employeeSlug`, `status`, `responseTimeMs`.
- [ ] `GET /api/admin/metrics/public-module` retorna cache hit ratio, conversions per minute e fallback ratio.
- [ ] Alertas/observabilidade sem erros 5xx inesperados nos primeiros 30 minutos.
- [ ] Conversoes antigas podem ser anonimizadas manualmente com `DELETE /api/admin/conversions/anonymize?olderThan=...`.

## Comunicacao interna

- [ ] Publicar changelog no canal de produto com escopo, riscos e links.
- [ ] Anexar screenshots mobile da landing, estado de sucesso e dashboard.
- [ ] Informar que CI usa `SHOPEE_MOCK=true`; API real da Shopee nao deve ser usada em PR.
- [ ] Informar empresa piloto, janela de acompanhamento e responsavel por rollback.

## Rollback

- [ ] Desativar landing piloto (`isActive=false`) se o fluxo publico falhar.
- [ ] Remover ou trocar slug publico se houver divulgacao incorreta.
- [ ] Manter fallback URL configurada antes de tentar novo deploy.
- [ ] Se necessario, bloquear origem publica via `PUBLIC_CORS_ORIGINS` e redeploy.
