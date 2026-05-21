# Analytics — Come Pouco Landing

## Princípios

- **Privacy-first**: sem cookies, sem fingerprinting, sem consent banner. LGPD compliance natural.
- **Foco em conversão**: cada evento responde "quem se interessou no quê?".
- **Sem 3rd party barulhento**: nada de GA, FB Pixel, Hotjar.

## Stack

- **Plausible.io** (cloud) — recomendado para o launch (USD ~9/mês, sem operação).
- **Umami self-hosted** — alternativa zero-custo se preferir manter no mesmo Coolify.

Decisão fica pendente em §17 / Fase 4.13.

## Variáveis de ambiente

- `PUBLIC_ANALYTICS_SCRIPT` — URL completa do script (ex.: `https://plausible.io/js/script.js` ou `https://analytics.come-pouco.com.br/script.js`).
- `PUBLIC_PLAUSIBLE_DOMAIN` — domínio configurado no provider (ex.: `come-pouco.com.br`).

Em produção, adicione tag `<script defer data-domain={...} src={...}>` no `BaseLayout.astro` (TODO se decidir provedor).

## Helper

`src/lib/analytics.ts`:

```ts
import { trackEvent, attachEventTracking } from '@lib/analytics';

trackEvent('cta_click_hero_primary'); // chamada direta
trackEvent('lead_form_success', { plan: 'pro' }); // com props

attachEventTracking(); // auto-binding
```

`attachEventTracking()` instala um único listener no `document` que detecta cliques em qualquer elemento com `data-event="<EventName>"`. Props extras vêm de atributos `data-event-prop-*`.

Já chamado uma vez no `pages/index.astro`.

## Eventos rastreados

| Evento                         | Origem                                   |
| ------------------------------ | ---------------------------------------- |
| `cta_click_hero_primary`       | Botão "Começar grátis" no Hero           |
| `cta_click_hero_secondary`     | Botão "Ver como funciona" no Hero        |
| `cta_click_header_register`    | Botão "Começar grátis" no Header desktop |
| `cta_click_mobile_register`    | Botão "Começar grátis" no drawer mobile  |
| `cta_click_pricing_free`       | CTA do card Free                         |
| `cta_click_pricing_pro`        | CTA do card Pro                          |
| `cta_click_pricing_enterprise` | CTA do card Enterprise                   |
| `cta_click_final`              | CTA do banner final                      |
| `pricing_toggle_yearly`        | Toggle Mensal/Anual indo para Anual      |
| `alli_demo_interact`           | Botão "Ver demo ao vivo" no AlliShowcase |
| `lead_form_submit`             | Submit do formulário de lead             |
| `lead_form_success`            | Resposta 2xx do endpoint de lead         |
| `lead_form_error`              | Falha no envio do lead (rede / 5xx)      |
| `faq_expand`                   | Cada `<details>` do FAQ ao ser aberto    |

## Validação

1. DevTools → Application → Cookies → vazio (sem cookies).
2. DevTools → Network → script de analytics carrega `defer`.
3. Plausible/Umami dashboard mostra os eventos custom acima.
4. Lighthouse Performance não degrada (script < 1kb gzip).
