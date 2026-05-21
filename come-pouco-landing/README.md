# come-pouco-landing

Landing institucional/marketing da **Come Pouco**, construída em **Astro 5 + Tailwind v4**, servindo em `come-pouco.com.br` (raiz). A app autenticada continua em `app.come-pouco.com.br`.

> Visual de referência (Linear / Vercel / Stripe) com PT-BR, mobile-first, Lighthouse-friendly, JS shipping mínimo (Astro entrega zero JS por padrão; ilhas só onde precisa).

## Como rodar

```bash
# A partir da raiz do monorepo
npm run install:landing   # instala dependências do pacote
npm run dev:landing       # http://localhost:4321
npm run build:landing     # build estático em dist/
```

Para subir backend + frontend + landing juntos:

```bash
npm run dev:all
```

## Variáveis de ambiente

Veja `.env.example`. Em produção, defina pelo menos:

- `PUBLIC_SITE_URL` — URL pública da landing (sem barra final)
- `PUBLIC_APP_URL` — URL da app autenticada (usada nos CTAs)
- `LEAD_API_URL` — endpoint do formulário de lead (`/api/public/leads` do backend)
- `PUBLIC_ANALYTICS_SCRIPT` + `PUBLIC_PLAUSIBLE_DOMAIN` — Plausible / Umami

## Estrutura

```
come-pouco-landing/
├── astro.config.mjs            # site, integrations (sitemap, mdx), tailwind via vite plugin
├── tsconfig.json               # strict, com paths @components / @lib / @styles / @layouts
├── package.json                # deps Astro 5 / Tailwind 4 / lucide-astro / fontsource manrope
├── public/                     # assets servidos como-são
│   ├── favicon.svg
│   ├── manifest.json
│   ├── robots.txt
│   ├── og/default.svg
│   └── illustrations/*.svg
├── docs/                       # brand, voice, analytics, launch checklist, lighthouse runs
└── src/
    ├── styles/
    │   ├── tokens.css          # CSS vars portadas da Fase 1 + tokens de marketing
    │   └── global.css          # Tailwind v4 + @theme inline + base/utilities
    ├── layouts/BaseLayout.astro
    ├── components/
    │   ├── ui/                 # Button, Badge, Container, Section, Card, IconBox, Icon, GradientBlob, BrowserFrame, PhoneFrame
    │   ├── brand/              # Logo, LogoMark
    │   ├── layout/             # Header, Footer, MobileNav, ThemeToggle
    │   ├── seo/                # SeoHead, SchemaJsonLd
    │   └── sections/           # Hero, TrustStrip, Features, AlliShowcase, HowItWorks, Security, Pricing, PricingComparison, FAQ, FinalCTA, LeadForm
    ├── lib/                    # analytics, plans, features, faq, navigation
    └── pages/
        ├── index.astro
        ├── 404.astro
        └── dev/components.astro
```

## Como adicionar uma nova seção

1. Crie `src/components/sections/MinhaSecao.astro` consumindo `Container` + `Section`.
2. Use componentes de `components/ui/*` para manter consistência visual.
3. Importe em `src/pages/index.astro` e posicione na ordem do fluxo.
4. Se a seção tiver CTA, marque o botão com `dataEvent="..."` (ver `src/lib/analytics.ts` para a lista válida).
5. Se tiver schema (FAQ, produto, breadcrumbs), passe via `schemaType` + `schemaData` no `BaseLayout`.

## Como editar conteúdo

Conteúdo declarativo vive em `src/lib/`:

- `lib/features.ts` — features-âncora, selos de segurança, passos do onboarding
- `lib/plans.ts` — tiers de pricing + tabela comparativa
- `lib/faq.ts` — perguntas e respostas
- `lib/navigation.ts` — nav principal, footer, redes sociais

Editar copy = editar esses arquivos e fazer commit. Sem CMS por enquanto.

## Dark mode

Three-state toggle (`light` / `dark` / `system`) com persistência em `localStorage('come_pouco_theme')`. Script anti-FOUC roda inline no `<head>` antes do CSS pintar. `ThemeToggle.astro` é a ilha controladora.

## Analytics

`src/lib/analytics.ts` expõe `trackEvent(name, props?)` que despacha para `window.umami.track` ou `window.plausible`, com fallback de `console.info` em dev. Auto-instrumentação via `data-event="..."` em qualquer elemento clicável (ver `attachEventTracking()` no `pages/index.astro`).

Eventos definidos: `cta_click_hero_primary`, `cta_click_hero_secondary`, `cta_click_pricing_free`, `cta_click_pricing_pro`, `cta_click_pricing_enterprise`, `cta_click_final`, `cta_click_header_register`, `cta_click_mobile_register`, `lead_form_submit`, `lead_form_success`, `lead_form_error`, `alli_demo_interact`, `pricing_toggle_yearly`, `faq_expand`.

## Galeria de componentes

`/dev/components` lista todos os primitivos do design system. Só renderiza em `import.meta.env.DEV`; em build de produção, redireciona para 404.

## Deploy

Astro produz HTML estático em `dist/`. Compatível com Cloudflare Pages, Coolify (estático), Netlify, Vercel etc. Headers de segurança recomendados em `docs/launch-checklist.md`.
