# Come Pouco Monorepo

Estrutura inicial com frontend Angular, backend Node.js + Express + TypeScript e PostgreSQL em Docker.

## Estrutura

- `come-pouco-frontend`: app Angular com tela de login e home protegida.
- `come-pouco-backend`: API Express em TypeScript com autenticação JWT e conexão com Postgres.
- `database/init/01-init.sql`: criação de tabela e seed de usuário de teste.
- `docker-compose.yml`: ambiente local do PostgreSQL.

## Pré-requisitos

- Node.js 22+
- npm 10+
- Docker + Docker Compose

## Subir banco de dados

```bash
docker compose up -d
```

## Backend

```bash
cd come-pouco-backend
cp .env.example .env
npm install
npm run dev
```

API em `http://localhost:3000`.

## Frontend

```bash
cd come-pouco-frontend
npm install
npm start
```

App em `http://localhost:4200`.

## Credenciais de teste

- E-mail: `admin@comepouco.local`
- Senha: `123456`

## Fluxo implementado

- `GET /login`: login de usuário existente.
- `GET /register`: cadastro de novo usuário.
- `GET /home`: rota protegida após autenticação.
- `GET /users`: CRUD de usuários (listar, criar, editar e excluir).
- `GET /affiliate-links`: CRUD de links de afiliados (link original, imagem, frase chamativa e link afiliado).
- interceptor HTTP no frontend para enviar `Authorization: Bearer <token>` automaticamente.
