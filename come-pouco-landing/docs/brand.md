# Brand Kit — Come Pouco

> Versão de marca da landing institucional. Herda a paleta da Fase 1 (Jade Signal) e adiciona elementos próprios de marketing.

## Posicionamento

**Come Pouco** é uma plataforma profissional de gestão de afiliados Shopee. O nome carrega leveza ("come pouco" = consumo consciente, ROI sobre tempo) sem ser cafona. A landing precisa transmitir:

- **Autoridade técnica** — sem parecer engenharia árida.
- **Brasilidade sem regionalismo** — escrita em PT-BR neutro.
- **Resultado tangível** — números, conversão, dashboard real, não promessas vagas.

## Logo

- **Wordmark**: `LogoMark` (símbolo geométrico hexagonal com núcleo sólido) + texto "Come Pouco" em Manrope 760, com o termo "Pouco" pintado com o gradiente da marca quando em versão color.
- **Variações disponíveis**: `color` (gradiente), `mono` (segue `currentColor`, ideal para dark/light invertidos).
- **Espaço de respiro mínimo**: igual à altura do `LogoMark` em todos os lados.

Fonte: `src/components/brand/Logo.astro` e `LogoMark.astro`.

## Paleta

Toda a paleta vive em CSS variables em `src/styles/tokens.css`. Resumo:

### Light

| Token                   | Valor     |
| ----------------------- | --------- |
| `--cp-color-primary`    | `#0f766e` |
| `--cp-color-accent`     | `#f97316` |
| `--cp-color-background` | `#f7f8fa` |
| `--cp-color-surface`    | `#ffffff` |
| `--cp-color-foreground` | `#101418` |
| `--cp-color-border`     | `#dde3ea` |

### Dark

| Token                   | Valor     |
| ----------------------- | --------- |
| `--cp-color-primary`    | `#2dd4bf` |
| `--cp-color-accent`     | `#fb923c` |
| `--cp-color-background` | `#07090c` |
| `--cp-color-surface`    | `#0e141b` |
| `--cp-color-foreground` | `#e6edf3` |
| `--cp-color-border`     | `#243040` |

### Gradiente da marca (apenas marketing)

```
linear-gradient(120deg, #0f766e → #14b8a6 (55%) → #f97316)
```

Disponível em `--cp-mkt-hero-grad-start/-mid/-end` e usado na classe `cp-grad-text`, no logo color, no `GradientBlob` e no OG default.

## Tipografia

- **Família**: [Manrope Variable](https://fontsource.org/fonts/manrope) (`@fontsource-variable/manrope`), com fallback para Segoe UI / system sans.
- **Display** (Hero): `clamp(40px, 6vw, 68px)`, weight 760, tracking `-0.03em`.
- **H1 padrão**: `clamp(32px, 4.2vw, 52px)`, weight 720.
- **H2**: `clamp(26px, 3vw, 38px)`, weight 700.
- **Body LG** (leads, subheads): 18 / 28.
- **Body**: 16 / 26.
- **Caption / Label**: 12-13.

## Ícones

[Lucide](https://lucide.dev/) via `lucide-astro`. Conjunto curado em `src/components/ui/Icon.astro` — adicionar novos ícones lá, mantendo o set enxuto. Stroke padrão: `1.75`. Nunca misturar com Heroicons, Feather ou outro set.

## Ilustrações

Estilo abstrato/geométrico leve, paleta restrita à marca. Fontes em `public/illustrations/*.svg`:

- `affiliates.svg` — rede multi-tenant
- `automation.svg` — entrada de dados → processamento → checkmark
- `dashboard.svg` — gráfico + KPI cards
- `security.svg` — escudo + cadeado
- `audience.svg` — telefone com cupom

Quando substituir por arte definitiva, manter dimensões 400×300 e o mesmo gradient ID base para evitar conflitos.

## Mockups de produto

Componentes `BrowserFrame` (desktop) e `PhoneFrame` (mobile) renderizam mockups com chrome próprio em CSS puro. **Importante**: usar screenshots reais da app pós-Fase 1; enquanto isso, conteúdo demonstrativo HTML/SVG dentro do frame (ver `sections/Hero.astro`).

## Tom de voz

Detalhado em [voice.md](./voice.md). Resumo:

- 2ª pessoa ("você"), sem formalidade artificial
- Direto, sem buzzword vazio
- Brasileiro neutro (sem "mano", sem regionalismo)
- Resultado > recurso ("venda mais" > "geração programática de links")
