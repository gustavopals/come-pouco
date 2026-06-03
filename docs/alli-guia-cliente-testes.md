# Guia de testes do modulo publico Alli

Data: 21/05/2026

Este documento explica como o modulo publico Alli foi implementado no Come Pouco, como configurar a funcionalidade e quais fluxos o cliente deve testar.

O Alli permite que cada empresa tenha uma pagina publica, sem login, onde qualquer visitante cola um link da Shopee e abre a Shopee em uma nova aba com o rastreamento de afiliado da empresa aplicado.

## 1. Enderecos de acesso

Use os enderecos do ambiente entregue para testes.

| Area                                         | URL                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Painel autenticado                           | `https://app.auralinks.com.br`                                           |
| API publica                                  | `https://api.auralinks.com.br/api`                                       |
| Landing publica da empresa                   | `https://app.auralinks.com.br/p/<slug-da-empresa>`                       |
| Landing publica atribuida a colaborador      | `https://app.auralinks.com.br/p/<slug-da-empresa>/<slug-do-colaborador>` |
| Ambiente local, se usado pela equipe tecnica | `http://localhost:4200`                                                  |

Exemplo de URL publica:

```text
https://app.auralinks.com.br/p/minha-loja
```

Exemplo com colaborador:

```text
https://app.auralinks.com.br/p/minha-loja/ana
```

## 2. Logins e perfis

O visitante final da landing publica nao precisa de login.

Para configurar e validar o modulo no painel, use os perfis abaixo.

| Perfil                  | Login                   | Senha                   | O que consegue testar                                                                                       |
| ----------------------- | ----------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| ADMIN                   | `admin`                 | `comepouco102030@`      | Empresas, usuarios, plataformas Shopee, slugs de usuarios e dashboard geral.                                |
| OWNER da empresa piloto | A confirmar/provisionar | A confirmar/provisionar | Configuracao da landing em `Minha Empresa`, equipe, slugs dos colaboradores e dashboard da propria empresa. |
| EMPLOYEE                | Opcional                | Opcional                | Uso operacional do painel autenticado. Nao e necessario para o visitante usar a landing publica.            |

Observacao: se o ambiente tiver 2FA ativo, o login pode pedir codigo do app autenticador ou codigo de backup.

## 3. O que foi implementado

A Fase 3 implementou um produto publico chamado Alli, dividido em quatro blocos principais.

1. Landing publica por empresa:
   - Rota Angular publica: `/p/<companySlug>`.
   - Rota com atribuicao de colaborador: `/p/<companySlug>/<employeeSlug>`.
   - Layout proprio, sem sidebar e sem exigir autenticacao.
   - Modulo Angular lazy-loaded separado da area autenticada.
   - O `AuthInterceptor` ignora chamadas para `/api/public/*`.
   - Conteudo customizavel por empresa: slug, banner, titulo, subtitulo, passos, cor primaria, logo e URL de fallback.

2. Conversao publica de links Shopee:
   - Endpoint publico: `POST /api/public/convert`.
   - Aceita link longo da Shopee, link curto `shope.ee`, `br.shp.ee` e `s.shopee.com.br`.
   - Normaliza links e remove parametros de afiliados de terceiros.
   - Expande shortlinks antes de converter.
   - Chama a integracao Shopee ja existente no sistema.
   - Redireciona automaticamente o visitante para o link afiliado.

3. Fallback e protecao:
   - Se a API Shopee falhar, o visitante e enviado para a URL de fallback Shopee configurada na empresa.
   - O visitante nao ve erro tecnico quando existe fallback configurado.
   - O modulo tem rate limit por IP, honeypot anti-spam e hash de IP para LGPD.

4. Analytics:
   - Cada tentativa gera uma `Conversion`.
   - O dashboard mostra total, sucesso, fallback, media diaria, top produtos, top colaboradores e linha do tempo.
   - Os dados podem ser filtrados por 7, 30 ou 90 dias e por colaborador.

## 4. Como configurar uma empresa para teste

### 4.1. Configurar plataforma Shopee

Acesse o painel como ADMIN.

1. Abra `Plataformas`.
2. Clique em `Cadastrar Plataforma de Compras`.
3. Preencha:
   - `Nome`: exemplo `Shopee Brasil`.
   - `Descricao`: texto interno para identificar a integracao.
   - `Tipo da Plataforma`: `SHOPEE`.
   - `App ID` e `Secret`: credenciais reais da Shopee, quando o teste for real.
   - `Link da API`: normalmente `https://open-api.affiliate.shopee.com.br/graphql`.
   - `Ativo?`: ligado.
   - `Modo Sandbox (Mock)`: ligado apenas quando o teste nao deve chamar a Shopee real.
   - `Empresas autorizadas`: selecione a empresa piloto.
   - `Padrao (default) para esta empresa`: marque a empresa piloto.
4. Salve.

Importante:

- Em modo mock, o sistema nao chama a Shopee real e gera links simulados.
- Em modo real, a plataforma precisa estar ativa, com `App ID`, `Secret` e `Link da API` validos.
- Se o redirecionamento final abrir `https://shopee.mock/...`, o ambiente esta em mock. Para teste real de compra/rastreamento na Shopee, a equipe tecnica precisa garantir `SHOPEE_MOCK=false` e plataforma sem `Modo Sandbox (Mock)`.

### 4.2. Criar ou editar a empresa

Acesse como ADMIN.

1. Abra `Empresas`.
2. Crie ou edite a empresa piloto.
3. Preencha `Nome da empresa`.
4. Em `Plataforma Shopee`, selecione a plataforma criada.
5. Salve.

### 4.3. Criar usuario OWNER

Acesse como ADMIN.

1. Abra `Usuarios`.
2. Crie um usuario para a empresa piloto.
3. Defina o papel global como usuario comum e o papel na empresa como `OWNER`.
4. Entregue esse login ao cliente ou use-o para configurar a landing.

O OWNER e o perfil mais importante para validar a experiencia de configuracao da landing.

### 4.4. Configurar a landing publica

Acesse como OWNER da empresa piloto.

1. Abra `Minha Empresa`.
2. Entre na aba `Landing Publica`.
3. Preencha:
   - `Landing ativa`: ligado.
   - `Slug publico`: exemplo `minha-loja`.
   - `URL de fallback Shopee`: uma URL valida da Shopee.
   - `Texto do banner`: chamada curta exibida no topo.
   - `Emoji do banner`: opcional visual do banner.
   - `Titulo principal`: titulo da landing.
   - `Subtitulo`: texto de apoio.
   - `Cor primaria`: cor em hexadecimal, exemplo `#10b981`.
   - `Logo por URL`: URL publica da logo, se houver.
   - `Como funciona`: de 1 a 4 passos.
4. Clique em `Salvar landing`.
5. Use o painel `Preview` para conferir a pagina.
6. Clique em `Abrir` para testar em nova aba.

Regras importantes:

- O slug deve ter de 3 a 32 caracteres.
- O slug e salvo em kebab-case, sem acentos e sem espacos.
- Slugs reservados, como `admin`, `api`, `login`, `public`, `users`, `p`, `home` e `demo`, nao podem ser usados.
- A URL de fallback precisa ser uma URL da Shopee.
- Para ativar a landing, informe slug publico e URL de fallback.

### 4.5. Configurar slugs de colaboradores

Opcional, mas recomendado para testar atribuicao.

Como OWNER:

1. Abra `Minha Empresa`.
2. Entre na aba `Equipe`.
3. Se algum colaborador ainda nao existir, peça para um ADMIN cria-lo em `Usuarios`.
4. Na tabela `Usuarios da empresa`, use a coluna `Slug publico`.
5. Clique em `Definir slug` ou no slug existente.
6. Salve.

Como ADMIN:

1. Abra `Usuarios`.
2. Use a coluna `Slug publico`.
3. Edite o slug do usuario desejado.

A URL com colaborador fica assim:

```text
/p/<slug-da-empresa>/<slug-do-colaborador>
```

Conversoes feitas por esse link aparecem atribuidas ao colaborador no dashboard.

## 5. Como o visitante usa a landing

1. O visitante abre `/p/<slug-da-empresa>` ou `/p/<slug-da-empresa>/<slug-do-colaborador>`.
2. O frontend busca a configuracao publica da empresa.
3. A pagina mostra banner, titulo, subtitulo, formulario e passos configurados.
4. O visitante cola um link da Shopee.
5. O botao mostra `Buscando melhores cupons...`.
6. O backend prepara o link afiliado.
7. A tela mostra:
   - `Cupom aplicado!` quando houve sucesso direto.
   - `Abrindo a Shopee em nova aba...` quando entrou no fallback.
8. Em cerca de 2 segundos, a Shopee abre automaticamente em uma nova aba.
9. O visitante permanece na landing publica, e o botao `Abrir Shopee em nova aba` fica disponivel durante a contagem caso o navegador bloqueie a abertura automatica.

Se o link informado nao for da Shopee, a tela mostra a validacao `Use um link valido da Shopee`.

## 6. Como funciona por dentro

### 6.1. Carregamento da landing

Ao abrir `/p/<slug>`, o Angular carrega o modulo publico e chama:

```http
GET /api/public/landing/:slug
```

Esse endpoint retorna apenas campos seguros:

- Nome da empresa.
- Slug publico.
- Configuracao visual da landing.

Ele nao retorna a URL de fallback nem credenciais internas.

Se o slug nao existir ou a landing estiver inativa, retorna 404 e o frontend mostra a pagina publica de nao encontrado.

### 6.2. Conversao do link

Ao enviar o formulario, o frontend chama:

```http
POST /api/public/convert
```

Payload principal:

```json
{
  "url": "https://shopee.com.br/product/10001/20002",
  "companySlug": "minha-loja",
  "employeeSlug": "ana",
  "website": ""
}
```

O campo `website` e um honeypot escondido. Visitantes reais nao preenchem esse campo. Bots que preenchem recebem uma resposta falsa de sucesso e sao registrados como `BOT_DETECTED`.

### 6.3. Validacao de URL Shopee

O backend aceita:

- `https://shopee.com.br/product/{shopId}/{itemId}`
- `https://shopee.com.br/nome-do-produto-i.{shopId}.{itemId}`
- `https://shope.ee/<codigo>`
- `https://br.shp.ee/<codigo>`
- `https://s.shopee.com.br/<codigo>`
- Outras URLs Shopee validas, como busca ou categoria, quando a Shopee aceitar gerar shortlink.

O backend rejeita:

- URL vazia.
- URL malformada.
- Dominios que nao sejam Shopee.
- Protocolos que nao sejam `http` ou `https`.

Durante a normalizacao, parametros de afiliado de terceiros e parametros de tracking sao removidos.

### 6.4. Shortlinks

Quando o visitante usa `shope.ee`, `br.shp.ee` ou `s.shopee.com.br`, o backend:

1. Faz expansao por redirect HTTP.
2. Tenta `HEAD` primeiro.
3. Usa `GET` como alternativa quando necessario.
4. Limita a 5 redirecionamentos.
5. Usa timeout configuravel, com padrao de 5 segundos.
6. Guarda o resultado em cache por 7 dias.

### 6.5. Cache

O modulo usa cache em memoria com `lru-cache`.

- Conversoes repetidas: cache por 30 minutos.
- Shortlinks expandidos: cache por 7 dias.
- O cache evita chamadas duplicadas a Shopee e melhora o tempo de resposta.
- O cache e por instancia do backend. Em ambiente com varias instancias, cada uma tem seu proprio cache.

### 6.6. Chamada Shopee e rastreamento

O Alli reaproveita a integracao Shopee ja existente no sistema. A plataforma usada e a plataforma Shopee vinculada a empresa.

O rastreamento enviado para a Shopee usa ate 3 sub_ids:

- `sub_id1`: slug da empresa.
- `sub_id2`: slug do colaborador ou `direct`.
- `sub_id3`: id da conversao criada pelo backend.

Isso permite analisar conversoes por empresa, colaborador e evento.

### 6.7. Fallback

Se a Shopee falhar, retornar vazio, expirar ou a expansao de shortlink falhar, o sistema usa a `URL de fallback Shopee` configurada na empresa.

O resultado fica com status `FALLBACK`, mas para o visitante a experiencia continua fluida: ele ainda e enviado para a Shopee.

Se nao houver fallback configurado, o backend retorna erro e o frontend mostra a tela `Algo deu errado`.

### 6.8. Registro de conversoes

Cada tentativa grava uma linha na tabela `conversions`.

Campos importantes:

- Empresa.
- Colaborador, quando informado.
- URL original.
- URL normalizada.
- Link afiliado ou fallback.
- Item e loja Shopee, quando identificados.
- Status: `SUCCESS`, `FALLBACK`, `ERROR` ou `BOT_DETECTED`.
- Modo: `MOCK` ou `REAL`.
- Tempo de resposta.
- IP em hash HMAC, sem armazenar IP bruto.
- User-agent e referrer sanitizados.

## 7. Dashboard e acompanhamento

### 7.1. Card na Home

Quando a empresa tem landing ativa, a Home mostra o card `Conversoes da Landing`.

O card exibe:

- Total dos ultimos 7 dias.
- Taxa de sucesso.
- Taxa de fallback.
- Media diaria.
- Atalho `Ver dashboard`.

### 7.2. Tela Conversoes

Acesse `Conversoes` no menu lateral.

Disponivel para:

- ADMIN.
- OWNER.

A tela mostra:

- Filtros de periodo: `7 dias`, `30 dias`, `90 dias`.
- Filtro por `Colaborador`.
- Agrupamento por `Dia` ou `Hora`.
- Cards: `Total`, `Sucesso`, `Fallback`, `Media diaria`.
- Grafico de linha por status.
- Tabela `Top produtos`.
- Tabela `Top colaboradores`.

Para OWNER, os dados ficam restritos a empresa do usuario.

Para ADMIN, o dashboard consolida o ambiente.

## 8. Protecoes e LGPD

O modulo publico foi construido para nao exigir login do visitante, mas ainda assim proteger a aplicacao.

Protecoes implementadas:

- Rate limit em `GET /api/public/landing/:slug`: 60 requisicoes por minuto por IP.
- Rate limit em `POST /api/public/convert`: 30 requisicoes por minuto por IP.
- Limite diario em `POST /api/public/convert`: 200 requisicoes por dia por IP.
- Honeypot anti-spam no formulario.
- Hash de IP com HMAC-SHA256.
- Sanitizacao de user-agent e referrer.
- Logs estruturados com prefixo `[public-convert]`.
- Retencao configuravel por `CONVERSION_RETENTION_DAYS`, padrao 180 dias.

O IP bruto nao e salvo no banco. O documento tecnico de LGPD esta em `docs/lgpd-public-module.md`.

## 9. Checklist de testes para o cliente

### 9.1. Teste de configuracao

- Entrar como OWNER.
- Abrir `Minha Empresa`.
- Entrar na aba `Landing Publica`.
- Alterar titulo, subtitulo, cor primaria e passos.
- Salvar.
- Confirmar mensagem `Landing publica atualizada`.
- Clicar em `Abrir`.
- Verificar se a landing abriu com as alteracoes.

### 9.2. Teste de pagina publica

- Abrir `/p/<slug-da-empresa>` em janela anonima.
- Confirmar que nao pede login.
- Confirmar que aparecem logo/nome da empresa, banner, titulo, subtitulo e passos.
- Testar em celular ou viewport mobile.
- Confirmar que nao ha scroll horizontal.

### 9.3. Teste de URL invalida

- Colar uma URL que nao seja Shopee, por exemplo `https://google.com`.
- Confirmar mensagem `Use um link valido da Shopee`.
- Confirmar que nao houve redirecionamento.

### 9.4. Teste de URL Shopee longa

- Colar uma URL de produto Shopee.
- Clicar em `Preparar meu link`.
- Confirmar loading `Buscando melhores cupons...`.
- Confirmar tela de sucesso.
- Confirmar que o botao `Abrir Shopee em nova aba` aparece.
- Confirmar abertura automatica em uma nova aba para a Shopee ou link mock, conforme modo do ambiente.
- Confirmar que a landing publica permanece aberta na aba original.
- Voltar ao painel e confirmar que a conversao apareceu no dashboard.

### 9.5. Teste de shortlink

- Colar uma URL `https://shope.ee/<codigo>`, `https://br.shp.ee/<codigo>` ou `https://s.shopee.com.br/<codigo>`.
- Confirmar o mesmo comportamento do teste anterior.
- Em modo real, usar um shortlink real da Shopee.
- Em modo mock, a expansao pode usar o destino configurado para teste.

### 9.6. Teste de colaborador

- Definir slug publico para um colaborador.
- Abrir `/p/<slug-da-empresa>/<slug-do-colaborador>`.
- Fazer uma conversao.
- Abrir `Conversoes`.
- Filtrar pelo colaborador.
- Confirmar que a conversao aparece atribuida ao colaborador.

### 9.7. Teste de fallback

Este teste normalmente deve ser feito com apoio tecnico, porque exige simular falha da Shopee.

Opcoes:

- Ativar modo mock com padrao de falha configurado pela equipe tecnica.
- Usar credenciais Shopee invalidas em ambiente de homologacao.
- Indisponibilizar temporariamente a integracao em ambiente controlado.

Resultado esperado:

- O visitante ve fluxo normal, com abertura da Shopee em nova aba.
- A conversao aparece no dashboard como fallback.
- O link final usa a `URL de fallback Shopee` da empresa.

### 9.8. Teste de landing inativa

- Como OWNER, desligar `Landing ativa`.
- Salvar.
- Abrir `/p/<slug-da-empresa>` em janela anonima.
- Confirmar pagina de nao encontrado.
- Reativar a landing ao final do teste.

## 10. Configuracoes tecnicas relevantes

Estas variaveis sao configuradas no backend.

| Variavel                       | Uso                                                                   |
| ------------------------------ | --------------------------------------------------------------------- |
| `SHOPEE_MOCK`                  | Quando `true`, a aplicacao nao chama a Shopee real.                   |
| `SHOPEE_MOCK_FAILURE_PATTERN`  | Permite forcar falha mock quando a URL contem um marcador especifico. |
| `PUBLIC_CACHE_MAX_ENTRIES`     | Quantidade maxima de entradas do cache publico.                       |
| `PUBLIC_CACHE_DEFAULT_TTL_SEC` | TTL padrao do cache publico.                                          |
| `PUBLIC_CORS_ORIGINS`          | Origens autorizadas para endpoints publicos.                          |
| `PUBLIC_IP_HASH_SALT`          | Salt usado para hash de IP. Obrigatorio em producao.                  |
| `SHORTLINK_TIMEOUT_MS`         | Timeout de expansao de shortlinks. Padrao 5000 ms.                    |
| `SHORTLINK_MOCK_TARGET_URL`    | URL de destino usada para shortlinks em modo mock.                    |
| `CONVERSION_RETENTION_DAYS`    | Retencao de metadados pessoais de conversao. Padrao 180 dias.         |

Nenhum segredo deve ser compartilhado com o cliente. Credenciais Shopee, JWT, banco e salts ficam apenas no ambiente tecnico.

Para o cliente, a diferenca pratica e:

- Ambiente mock: valida tela, UX, dashboard e atribuicao, mas nao valida compra real na Shopee.
- Ambiente real: valida tambem chamada real da API Shopee e rastreamento afiliado real.

## 11. Endpoints principais

Publicos, sem login:

```http
GET /api/public/healthz
GET /api/public/landing/:slug
POST /api/public/convert
```

Autenticados:

```http
GET /api/companies/:id/landing-config
PUT /api/companies/:id/landing-config
PUT /api/companies/:id/public-slug
PUT /api/companies/:id/fallback-url
PUT /api/users/:id/public-slug
GET /api/dashboard/conversions/summary
GET /api/dashboard/conversions/top-products
GET /api/dashboard/conversions/by-employee
GET /api/dashboard/conversions/timeline
```

Admins:

```http
GET /api/admin/cache-stats
GET /api/admin/metrics/public-module
DELETE /api/admin/conversions/anonymize?olderThan=YYYY-MM-DD
```

## 12. Arquivos principais da implementacao

Frontend publico:

- `come-pouco-frontend/src/app/public/public.routes.ts`
- `come-pouco-frontend/src/app/public/public-layout.component.ts`
- `come-pouco-frontend/src/app/public/pages/public-home.component.ts`
- `come-pouco-frontend/src/app/public/services/public-landing.service.ts`
- `come-pouco-frontend/src/app/public/services/public-convert.service.ts`

Configuracao no painel:

- `come-pouco-frontend/src/app/pages/my-company/my-company.component.ts`
- `come-pouco-frontend/src/app/pages/users/users.component.ts`
- `come-pouco-frontend/src/app/pages/conversions/conversions-dashboard.component.ts`
- `come-pouco-frontend/src/app/core/services/landing-config.service.ts`
- `come-pouco-frontend/src/app/core/services/dashboard.service.ts`

Backend:

- `come-pouco-backend/src/routes/public.routes.ts`
- `come-pouco-backend/src/controllers/public.controller.ts`
- `come-pouco-backend/src/services/public-conversion.service.ts`
- `come-pouco-backend/src/services/shopee-url-parser.service.ts`
- `come-pouco-backend/src/services/shortlink-expander.service.ts`
- `come-pouco-backend/src/services/landing-config.service.ts`
- `come-pouco-backend/src/services/dashboard.service.ts`
- `come-pouco-backend/src/middlewares/public-rate-limit.middleware.ts`
- `come-pouco-backend/src/utils/ip-hash.ts`

Banco:

- `come-pouco-backend/prisma/migrations/202605211000_add_public_module/migration.sql`
- `come-pouco-backend/prisma/migrations/202605211100_add_bot_detected_conversion_status/migration.sql`
- `come-pouco-backend/prisma/migrations/202605211200_conversion_product_name/migration.sql`

Documentacao complementar:

- `docs/public-module.md`
- `docs/public-module-launch-checklist.md`
- `docs/lgpd-public-module.md`

## 13. Limites conhecidos desta fase

- Custom domain por empresa ainda nao faz parte desta fase. A URL publica usa `/p/<slug>` dentro do app.
- Edicao visual rica da landing nao faz parte desta fase. A configuracao atual cobre textos, cor, logo por URL e passos.
- Captcha nao foi usado para nao adicionar atrito. A protecao atual combina rate limit, honeypot e logs.
- SSR/SSG para SEO avancado nao foi implementado. A landing foi desenhada como destino de trafego social.
- Para uma validacao real ponta a ponta, a plataforma Shopee precisa estar em modo real, com credenciais validas e `SHOPEE_MOCK=false`.
