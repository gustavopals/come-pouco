# syntax=docker/dockerfile:1.7

# Stage 1: build estático do Astro
FROM node:22-alpine AS builder
WORKDIR /app

# Copia apenas os manifests primeiro para aproveitar o cache de deps quando
# nenhuma dependência mudou.
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Agora o resto do código.
COPY . .

# Build args sobrescrevem PUBLIC_* em tempo de build (Astro injeta no HTML).
ARG PUBLIC_SITE_URL=https://auralinks.com.br
ARG PUBLIC_APP_URL=https://app.auralinks.com.br
ARG PUBLIC_LEAD_API_URL=https://api.auralinks.com.br/api/public/leads
ARG PUBLIC_PLAUSIBLE_DOMAIN=
ARG PUBLIC_ANALYTICS_SCRIPT=

ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL \
    PUBLIC_APP_URL=$PUBLIC_APP_URL \
    PUBLIC_LEAD_API_URL=$PUBLIC_LEAD_API_URL \
    PUBLIC_PLAUSIBLE_DOMAIN=$PUBLIC_PLAUSIBLE_DOMAIN \
    PUBLIC_ANALYTICS_SCRIPT=$PUBLIC_ANALYTICS_SCRIPT

RUN npm run build

# Stage 2: nginx alpine servindo o dist/
FROM nginx:1.27-alpine AS runner

# Configuração do nginx: gzip, cache headers diferenciados, SPA-like fallback.
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

# Healthcheck simples — Coolify usa pra marcar verde/vermelho.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
