# Contributing

Este repo é um monorepo npm com backend Express/Prisma, frontend Angular, landing Astro e E2E Playwright. Mantenha PRs pequenos, com validação local clara.

## Setup em 5 passos

1. Instale Node.js `22.12+`, npm `10+` e Docker.
2. Instale dependências:

   ```bash
   npm install
   ```

3. Configure o backend:

   ```bash
   cp come-pouco-backend/.env.example come-pouco-backend/.env
   ```

4. Suba o banco e aplique migrations:

   ```bash
   npm run db:up
   npm --prefix come-pouco-backend run prisma:deploy
   ```

5. Rode o ambiente:

   ```bash
   npm run dev:all
   ```

URLs locais:

- Backend API: `http://localhost:3000`
- Frontend app: `http://localhost:4200`
- Landing: `http://localhost:4321`

Credenciais locais padrão:

- Usuário: `admin`
- Senha: `comepouco102030@`

## Fluxo de PR

1. Crie branch curta e descritiva:

   ```bash
   git switch -c feat/nome-curto
   ```

2. Faça commits pequenos. Prefira conventional commits:

   ```text
   feat: adiciona coverage da landing
   fix: corrige fallback do auth interceptor
   docs: documenta fluxo de testes
   ```

3. Antes de abrir PR, rode o mínimo afetado. Para mudanças amplas:

   ```bash
   npm run lint
   npm run check
   npm run test:backend
   npm run test:frontend
   npm run test:landing
   ```

4. Se mexeu em coverage/test infra:

   ```bash
   npm run test:backend:cov
   npm run test:frontend:cov
   npm run test:landing:cov
   npm run coverage:badges
   ```

5. Se mexeu em fluxo crítico de usuário, rode ou liste E2E:

   ```bash
   npm run e2e:list
   npm run e2e
   ```

## Checklist de qualidade

- Código compila com `npm run check`.
- Lint e Prettier passam com `npm run lint`.
- Testes relevantes foram criados ou atualizados.
- Erros seguem o padrão `HttpError` no backend.
- Novas env vars entram em `.env.example` e docs.
- Mudanças de schema Prisma têm migration.
- Mudanças de comportamento atualizam `README.md`, `CLAUDE.md`, `IDEIA.md` ou docs em `docs/`.
- Dependências core seguem `docs/dependencies.md`.

## Como pedir review

Inclua no PR:

- resumo objetivo do que mudou;
- comandos executados e resultado;
- riscos conhecidos ou pontos que quer revisão;
- screenshots ou gravações quando mudar UI;
- observação explícita quando algum teste não foi rodado.

## Anti-padrões

- PR grande misturando feature, refactor e formatação global.
- `npm audit fix --force` sem revisão de breaking changes.
- Teste que só verifica se uma função interna foi chamada.
- Teste que depende de rede externa, relógio real sem controle ou dados de produção.
- Commit que altera arquivos não relacionados sem explicar o motivo.
