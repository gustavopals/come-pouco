# Come Pouco - Design System

Status: Task 1.1 documentada em 2026-05-20. A escolha operacional recomendada para a Fase 1 e a **Proposta B - Jade Signal**. Antes de iniciar a Task 1.2, confirmar se esta paleta segue aprovada ou se uma das alternativas deve assumir.

## 1. Direcao visual

**Tese visual**: uma interface SaaS operacional, calma e precisa, com superficies claras, tipografia densa, bordas discretas e um acento jade para acoes primarias.

**Plano de aplicacao**: login com primeira impressao refinada, app shell com navegacao lateral objetiva, paginas internas orientadas a dados e componentes reutilizaveis sem excesso de cards.

**Tese de interacao**:

- Transicoes curtas para menus, dialogs, drawers e troca de tema.
- Hover sutil em acoes e linhas interativas, sem deslocamentos grandes.
- Motion sempre desativavel por `prefers-reduced-motion`.

## 2. Propostas de paleta

As tres propostas abaixo seguem o estilo minimalista moderno indicado para a Fase 1, mantendo contraste forte, superficies contidas e uma cor de acao clara.

### Proposta A - Ledger Neutral

Uma paleta neutra elegante, quase editorial, com preto grafite e um acento oliva controlado. Boa para uma aplicacao muito sobria, mas tem menos personalidade de marca.

| Token              | Light                         | Dark                          |
| ------------------ | ----------------------------- | ----------------------------- |
| `background`       | `#FAFAFA` / `hsl(0 0% 98%)`   | `#0A0A0A` / `hsl(0 0% 4%)`    |
| `surface`          | `#FFFFFF` / `hsl(0 0% 100%)`  | `#171717` / `hsl(0 0% 9%)`    |
| `foreground`       | `#18181B` / `hsl(240 6% 10%)` | `#FAFAFA` / `hsl(0 0% 98%)`   |
| `primary`          | `#27272A` / `hsl(240 4% 16%)` | `#F4F4F5` / `hsl(240 5% 96%)` |
| `accent`           | `#4D7C0F` / `hsl(86 78% 27%)` | `#A3E635` / `hsl(83 78% 55%)` |
| `muted`            | `#F4F4F5` / `hsl(240 5% 96%)` | `#27272A` / `hsl(240 4% 16%)` |
| `muted-foreground` | `#71717A` / `hsl(240 4% 46%)` | `#A1A1AA` / `hsl(240 5% 65%)` |
| `border`           | `#E4E4E7` / `hsl(240 6% 90%)` | `#3F3F46` / `hsl(240 5% 26%)` |

**Uso indicado**: ambientes internos, paineis administrativos e telas com alta densidade.  
**Risco**: pode ficar generica demais para uma marca que precisa ser lembrada.

### Proposta B - Jade Signal (escolhida)

Uma paleta operacional com base grafite/fria, primary jade e accent tangerine. Preserva um eco das cores atuais do produto, mas reduz o visual para um sistema mais maduro.

| Token                | Light                          | Dark                           |
| -------------------- | ------------------------------ | ------------------------------ |
| `background`         | `#F7F8FA` / `hsl(220 23% 97%)` | `#0B0F14` / `hsl(213 29% 6%)`  |
| `surface`            | `#FFFFFF` / `hsl(0 0% 100%)`   | `#111821` / `hsl(214 32% 10%)` |
| `surface-raised`     | `#FFFFFF` / `hsl(0 0% 100%)`   | `#151F2A` / `hsl(211 33% 12%)` |
| `foreground`         | `#101418` / `hsl(210 20% 8%)`  | `#E6EDF3` / `hsl(208 35% 93%)` |
| `primary`            | `#0F766E` / `hsl(175 77% 26%)` | `#2DD4BF` / `hsl(172 66% 50%)` |
| `primary-foreground` | `#FFFFFF` / `hsl(0 0% 100%)`   | `#06201C` / `hsl(171 68% 7%)`  |
| `primary-soft`       | `#DDF8F3` / `hsl(169 66% 92%)` | `#123C37` / `hsl(173 54% 15%)` |
| `accent`             | `#F97316` / `hsl(25 95% 53%)`  | `#FB923C` / `hsl(27 96% 61%)`  |
| `accent-foreground`  | `#111827` / `hsl(221 39% 11%)` | `#1F1308` / `hsl(29 59% 8%)`   |
| `muted`              | `#EEF1F5` / `hsl(214 26% 95%)` | `#1A2430` / `hsl(213 30% 15%)` |
| `muted-foreground`   | `#637083` / `hsl(216 14% 45%)` | `#9AA8B7` / `hsl(211 17% 66%)` |
| `border`             | `#DDE3EA` / `hsl(212 24% 89%)` | `#2A3645` / `hsl(213 24% 22%)` |

**Uso indicado**: app principal, dashboards, tabelas, formularios e fluxos de autenticacao.  
**Motivo da escolha**: tem identidade suficiente sem virar uma interface decorativa. O jade diferencia a marca, o tangerine preserva energia comercial e os neutros sustentam telas densas.

### Proposta C - Mono Commerce

Uma paleta monocromatica contrastada com um unico acento verde. E a opcao mais proxima de ferramentas como Linear e Vercel, com forte foco em produtividade.

| Token              | Light                          | Dark                           |
| ------------------ | ------------------------------ | ------------------------------ |
| `background`       | `#FFFFFF` / `hsl(0 0% 100%)`   | `#0A0A0A` / `hsl(0 0% 4%)`     |
| `surface`          | `#FAFAFA` / `hsl(0 0% 98%)`    | `#171717` / `hsl(0 0% 9%)`     |
| `foreground`       | `#0A0A0A` / `hsl(0 0% 4%)`     | `#FAFAFA` / `hsl(0 0% 98%)`    |
| `primary`          | `#171717` / `hsl(0 0% 9%)`     | `#FAFAFA` / `hsl(0 0% 98%)`    |
| `accent`           | `#22C55E` / `hsl(142 71% 45%)` | `#4ADE80` / `hsl(142 69% 58%)` |
| `muted`            | `#F5F5F5` / `hsl(0 0% 96%)`    | `#171717` / `hsl(0 0% 9%)`     |
| `muted-foreground` | `#525252` / `hsl(0 0% 32%)`    | `#A3A3A3` / `hsl(0 0% 64%)`    |
| `border`           | `#E5E5E5` / `hsl(0 0% 90%)`    | `#262626` / `hsl(0 0% 15%)`    |

**Uso indicado**: produto extremamente tecnico e minimalista.  
**Risco**: perde conexao com o repertorio visual atual do Come Pouco e pode parecer pouco proprietaria.

## 3. Tokens escolhidos

Os tokens abaixo materializam a Proposta B e devem virar CSS custom properties em `src/styles/tokens.scss` na Task 1.2. O prefixo padrao e `--cp-*`.

### Cores semanticas

#### Light

| CSS variable                    | Valor     | Uso                                     |
| ------------------------------- | --------- | --------------------------------------- |
| `--cp-color-background`         | `#F7F8FA` | Fundo base da aplicacao                 |
| `--cp-color-surface`            | `#FFFFFF` | Superficies principais                  |
| `--cp-color-surface-raised`     | `#FFFFFF` | Dialogs, popovers e drawers             |
| `--cp-color-foreground`         | `#101418` | Texto principal                         |
| `--cp-color-muted`              | `#EEF1F5` | Areas secundarias e fills discretos     |
| `--cp-color-muted-foreground`   | `#5F6B7A` | Texto secundario                        |
| `--cp-color-border`             | `#DDE3EA` | Divisores e bordas                      |
| `--cp-color-primary`            | `#0F766E` | Acao primaria e foco de marca           |
| `--cp-color-primary-foreground` | `#FFFFFF` | Texto sobre primary                     |
| `--cp-color-primary-soft`       | `#DDF8F3` | Badges e backgrounds suaves de primary  |
| `--cp-color-accent`             | `#F97316` | Destaques pontuais e alertas comerciais |
| `--cp-color-accent-foreground`  | `#111827` | Texto sobre accent                      |
| `--cp-color-success`            | `#15803D` | Sucesso, ativo, salvo                   |
| `--cp-color-warning`            | `#B45309` | Avisos e estados pendentes              |
| `--cp-color-danger`             | `#DC2626` | Erros, delecao, bloqueios               |
| `--cp-color-info`               | `#2563EB` | Informacao e links auxiliares           |
| `--cp-color-focus`              | `#14B8A6` | Outline de foco                         |
| `--cp-color-code-bg`            | `#EEF6F5` | Blocos e labels tecnicos                |

#### Dark

| CSS variable                    | Valor     | Uso                                     |
| ------------------------------- | --------- | --------------------------------------- |
| `--cp-color-background`         | `#0B0F14` | Fundo base da aplicacao                 |
| `--cp-color-surface`            | `#111821` | Superficies principais                  |
| `--cp-color-surface-raised`     | `#151F2A` | Dialogs, popovers e drawers             |
| `--cp-color-foreground`         | `#E6EDF3` | Texto principal                         |
| `--cp-color-muted`              | `#1A2430` | Areas secundarias e fills discretos     |
| `--cp-color-muted-foreground`   | `#9AA8B7` | Texto secundario                        |
| `--cp-color-border`             | `#2A3645` | Divisores e bordas                      |
| `--cp-color-primary`            | `#2DD4BF` | Acao primaria e foco de marca           |
| `--cp-color-primary-foreground` | `#06201C` | Texto sobre primary                     |
| `--cp-color-primary-soft`       | `#123C37` | Badges e backgrounds suaves de primary  |
| `--cp-color-accent`             | `#FB923C` | Destaques pontuais e alertas comerciais |
| `--cp-color-accent-foreground`  | `#1F1308` | Texto sobre accent                      |
| `--cp-color-success`            | `#4ADE80` | Sucesso, ativo, salvo                   |
| `--cp-color-warning`            | `#FBBF24` | Avisos e estados pendentes              |
| `--cp-color-danger`             | `#F87171` | Erros, delecao, bloqueios               |
| `--cp-color-info`               | `#60A5FA` | Informacao e links auxiliares           |
| `--cp-color-focus`              | `#5EEAD4` | Outline de foco                         |
| `--cp-color-code-bg`            | `#142027` | Blocos e labels tecnicos                |

### Contraste basico

| Par                                    | Razao aproximada |
| -------------------------------------- | ---------------- |
| Light foreground sobre background      | `17.41:1`        |
| Light primary-foreground sobre primary | `5.47:1`         |
| Light accent-foreground sobre accent   | `6.33:1`         |
| Dark foreground sobre background       | `16.27:1`        |
| Dark primary-foreground sobre primary  | `9.16:1`         |
| Dark accent-foreground sobre accent    | `8.03:1`         |

## 4. Tipografia

Fonte principal: `Manrope Variable`, ja presente no frontend.  
Fonte de codigo: `ui-monospace`, `SFMono-Regular`, `Menlo`, `Monaco`, `Consolas`, monospace.

Regra geral: `letter-spacing: 0`. A hierarquia usa peso, tamanho e line-height, sem tracking negativo.

| Token               |   Size | Line-height | Weight | Uso                                            |
| ------------------- | -----: | ----------: | -----: | ---------------------------------------------- |
| `--cp-text-display` | `44px` |      `52px` |  `700` | Login, empty states grandes e paginas publicas |
| `--cp-text-h1`      | `36px` |      `44px` |  `700` | Titulo principal de pagina                     |
| `--cp-text-h2`      | `30px` |      `38px` |  `700` | Secoes importantes                             |
| `--cp-text-h3`      | `24px` |      `32px` |  `700` | Subsecao e dialogs                             |
| `--cp-text-h4`      | `20px` |      `28px` |  `650` | Cabecalho de painel                            |
| `--cp-text-h5`      | `18px` |      `26px` |  `650` | Labels de grupos                               |
| `--cp-text-h6`      | `16px` |      `24px` |  `650` | Titulos compactos                              |
| `--cp-text-body-lg` | `16px` |      `24px` |  `400` | Texto principal                                |
| `--cp-text-body`    | `14px` |      `22px` |  `450` | UI padrao, tabelas e forms                     |
| `--cp-text-body-sm` | `13px` |      `20px` |  `450` | Metadados e descricoes curtas                  |
| `--cp-text-caption` | `12px` |      `16px` |  `500` | Captions, hints e timestamps                   |
| `--cp-text-label`   | `12px` |      `16px` |  `650` | Labels, chips e navegacao                      |
| `--cp-text-code`    | `13px` |      `20px` |  `500` | Codigo, IDs, tokens e URLs                     |

## 5. Espacamento

Escala baseada em 4px. Estes tokens devem ser usados em Tailwind e SCSS para manter consistencia.

| Token           |  Valor | Uso comum                      |
| --------------- | -----: | ------------------------------ |
| `--cp-space-0`  |    `0` | Reset                          |
| `--cp-space-1`  |  `4px` | Separacao minima               |
| `--cp-space-2`  |  `8px` | Icone + texto, gaps pequenos   |
| `--cp-space-3`  | `12px` | Padding compacto               |
| `--cp-space-4`  | `16px` | Padding padrao                 |
| `--cp-space-6`  | `24px` | Gaps entre blocos              |
| `--cp-space-8`  | `32px` | Page sections compactas        |
| `--cp-space-12` | `48px` | Separacao entre regioes        |
| `--cp-space-16` | `64px` | Respiracao de paginas publicas |
| `--cp-space-24` | `96px` | Grandes faixas e auth visual   |

Tokens de layout derivados:

| Token                        | Valor    |
| ---------------------------- | -------- |
| `--cp-layout-page-gutter-sm` | `16px`   |
| `--cp-layout-page-gutter-md` | `24px`   |
| `--cp-layout-page-gutter-lg` | `32px`   |
| `--cp-layout-content-max`    | `1440px` |
| `--cp-layout-sidebar-width`  | `280px`  |
| `--cp-layout-sidebar-rail`   | `76px`   |
| `--cp-layout-topbar-height`  | `64px`   |

## 6. Raios

O produto deve parecer preciso e operacional. Cards usam no maximo `md`; `lg` fica reservado para dialogs, drawers e superficies mais imersivas.

| Token              |    Valor | Uso                              |
| ------------------ | -------: | -------------------------------- |
| `--cp-radius-sm`   |    `4px` | Inputs internos, badges pequenos |
| `--cp-radius-md`   |    `8px` | Cards, tabelas, botoes, menus    |
| `--cp-radius-lg`   |   `12px` | Dialogs, drawers, auth panels    |
| `--cp-radius-full` | `9999px` | Avatares, pills, toggles         |

## 7. Sombras

Bordas e contraste de superficie vem antes de sombra. Sombras devem ser discretas e usadas apenas onde ha sobreposicao ou elevacao real.

| Token            | Light                              | Dark                            |
| ---------------- | ---------------------------------- | ------------------------------- |
| `--cp-shadow-sm` | `0 1px 2px rgb(16 20 24 / 0.06)`   | `0 1px 2px rgb(0 0 0 / 0.32)`   |
| `--cp-shadow-md` | `0 8px 24px rgb(16 20 24 / 0.08)`  | `0 10px 28px rgb(0 0 0 / 0.36)` |
| `--cp-shadow-lg` | `0 18px 48px rgb(16 20 24 / 0.12)` | `0 18px 52px rgb(0 0 0 / 0.44)` |
| `--cp-shadow-xl` | `0 28px 80px rgb(16 20 24 / 0.16)` | `0 28px 86px rgb(0 0 0 / 0.52)` |

## 8. Motion

Motion deve reforcar orientacao, nao decorar telas rotineiras.

### Duracoes

| Token                   |   Valor | Uso                                 |
| ----------------------- | ------: | ----------------------------------- |
| `--cp-duration-instant` |  `80ms` | Feedback imediato                   |
| `--cp-duration-short`   | `140ms` | Hover, active e foco                |
| `--cp-duration-medium`  | `220ms` | Menus, popovers e theme toggle      |
| `--cp-duration-long`    | `360ms` | Drawers, dialogs e auth transitions |

### Easings

| Token                  | Valor                           | Uso                        |
| ---------------------- | ------------------------------- | -------------------------- |
| `--cp-ease-standard`   | `cubic-bezier(0.2, 0, 0, 1)`    | Movimento padrao           |
| `--cp-ease-emphasized` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrada de dialogs/drawers |
| `--cp-ease-exit`       | `cubic-bezier(0.4, 0, 1, 1)`    | Saidas rapidas             |

### Regras

- Respeitar `@media (prefers-reduced-motion: reduce)` zerando animacoes nao essenciais.
- Hover pode alterar cor, sombra e borda; evitar deslocamentos acima de `1px`.
- Route transitions devem usar opacidade e leve translate, nunca zoom exagerado.
- Dialogs e drawers entram com `duration-long` e `ease-emphasized`; saem com `duration-short` e `ease-exit`.

## 9. Mapeamento previsto para implementacao

### CSS variables

```scss
:root {
  --cp-color-background: #f7f8fa;
  --cp-color-foreground: #101418;
  --cp-color-primary: #0f766e;
  --cp-color-accent: #f97316;
  --cp-space-4: 16px;
  --cp-radius-md: 8px;
  --cp-duration-medium: 220ms;
}

.dark {
  --cp-color-background: #0b0f14;
  --cp-color-foreground: #e6edf3;
  --cp-color-primary: #2dd4bf;
  --cp-color-accent: #fb923c;
}
```

### Tailwind

Na Task 1.2, o Tailwind deve consumir estes tokens sem duplicar valores:

```ts
colors: {
  background: 'var(--cp-color-background)',
  foreground: 'var(--cp-color-foreground)',
  primary: 'var(--cp-color-primary)',
  accent: 'var(--cp-color-accent)',
  muted: 'var(--cp-color-muted)',
  border: 'var(--cp-color-border)'
}
```

### Angular Material

O tema MD3 customizado deve usar os mesmos tokens para evitar dois sistemas visuais concorrentes. O tema pre-construido `azure-blue` deve sair do `angular.json` durante a Task 1.2.

## 10. Decisoes finais da Task 1.1

- Paleta escolhida para implementacao: **Jade Signal**.
- Tipografia: Manrope Variable para toda a UI, monospace apenas para dados tecnicos.
- Espacamento: escala 4px com tokens `0, 1, 2, 3, 4, 6, 8, 12, 16, 24`.
- Radius: cards e controles em `8px`; dialogs/drawers em `12px`.
- Sombras: discretas, usadas apenas para elevacao real.
- Motion: curto, funcional, com suporte a reduced motion desde a base.
