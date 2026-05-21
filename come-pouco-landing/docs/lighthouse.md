# Lighthouse — benchmarks

Rodar antes de qualquer release significativo. Anexar prints em PR.

## Como rodar

```bash
# build de produção (gera dist/)
npm run build:landing

# servir local (qualquer SPA static server)
npx serve come-pouco-landing/dist -p 5000

# em outro terminal
npx lighthouse http://localhost:5000 \
  --view \
  --preset=desktop \
  --output=html \
  --output-path=./docs/lighthouse-desktop.html

npx lighthouse http://localhost:5000 \
  --view \
  --form-factor=mobile \
  --throttling-method=devtools \
  --output=html \
  --output-path=./docs/lighthouse-mobile.html
```

## Metas

| Métrica          | Mobile | Desktop |
| ---------------- | -----: | ------: |
| Performance      |   ≥ 95 |    ≥ 99 |
| Acessibilidade   |   ≥ 95 |    ≥ 95 |
| Best Practices   |   ≥ 95 |    ≥ 95 |
| SEO              |    100 |     100 |
| LCP              | < 1.5s |  < 1.0s |
| CLS              | < 0.05 |  < 0.02 |
| JS shipping (gz) | < 30kb |  < 30kb |

## Histórico

| Data       | Mobile P | Mobile A11y | Desktop P | Desktop A11y | Notas |
| ---------- | -------: | ----------: | --------: | -----------: | ----- |
| YYYY-MM-DD |        — |           — |         — |            — | —     |
