# Launch Checklist — Come Pouco Landing

Marque ✅ quando o item estiver concluído. **Não fazer hard launch antes de zerar a lista.**

## Domínio & DNS

- [ ] Domínio `come-pouco.com.br` registrado e em mãos
- [ ] DNS apex (`A` ou `ALIAS`) apontando pro host da landing
- [ ] `www.come-pouco.com.br` → redirect 301 pra apex
- [ ] `app.come-pouco.com.br` continua apontando pra app autenticada
- [ ] Certificado TLS válido (Let's Encrypt / CF)
- [ ] `HSTS` ativo: `max-age=31536000; includeSubDomains`

## Headers de segurança

- [ ] `Content-Security-Policy` configurado (permitir analytics, fonts, imagens)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy` minimal
- [ ] Cache: assets com hash → `Cache-Control: public, max-age=31536000, immutable`
- [ ] Cache: HTML → `Cache-Control: no-cache`
- [ ] Cache: OG images → `Cache-Control: public, max-age=86400`

## SEO

- [ ] `sitemap-index.xml` acessível e listado no `robots.txt`
- [ ] `robots.txt` correto (disallow `/dev/`)
- [ ] `<title>` único em cada página
- [ ] `meta description` ≤ 160 chars em cada página
- [ ] OG image renderiza corretamente no Facebook Sharing Debugger
- [ ] OG image renderiza corretamente no LinkedIn Post Inspector
- [ ] Twitter Card preview ok no Twitter Card Validator
- [ ] JSON-LD `Organization` validado em Google Rich Results Test
- [ ] JSON-LD `Product` validado
- [ ] JSON-LD `FAQPage` validado
- [ ] `canonical` correto em cada página

## Performance

- [ ] Lighthouse Performance ≥ 95 mobile e desktop
- [ ] LCP < 1.5s mobile (4G simulado)
- [ ] CLS < 0.05
- [ ] JS total enviado ao cliente < 30kb gzipped
- [ ] Todas imagens com `width/height` explícitos
- [ ] AVIF + WebP via `astro:assets` em screenshots

## Acessibilidade

- [ ] axe-core / Lighthouse A11y: 0 violações
- [ ] Skip link funcional
- [ ] Foco visível em todos os elementos interativos (auditar por teclado)
- [ ] WCAG AA contraste em light + dark
- [ ] `prefers-reduced-motion` respeitado em todas as animações
- [ ] aria-labels em ícones-only buttons

## Conteúdo

- [ ] H1 final validado com o usuário (decisão pendente — Task 4.5.1)
- [ ] Valores finais de pricing confirmados (decisão pendente — Task 4.9.1)
- [ ] 10 perguntas+respostas do FAQ revisadas
- [ ] Lista de features auditada contra o que a app entrega hoje
- [ ] Selos de segurança auditados contra estado real pós-Fase 2
- [ ] Mockups substituídos por screenshots reais da app pós-Fase 1
- [ ] Logos da TrustStrip substituídos pelos reais (ou removidos)

## Analytics

- [ ] Provider Plausible / Umami provisionado
- [ ] `data-domain` correto no script
- [ ] Eventos custom batendo no dashboard
- [ ] DevTools confirma 0 cookies salvos

## Legal

- [ ] Página `/privacidade` (placeholder ou versão jurídica)
- [ ] Página `/termos` (placeholder ou versão jurídica)
- [ ] Página `/lgpd` (placeholder ou versão jurídica)
- [ ] Footer linka as três

## Lead capture

- [ ] Backend `POST /api/public/leads` em produção
- [ ] Rate limit ativo (10/h/IP)
- [ ] Honeypot funcional (submeter com campo `website` preenchido = bloqueado)
- [ ] Email de notificação chegando na caixa correta
- [ ] Caixa de destino NÃO é email pessoal

## CI/CD

- [ ] Pipeline build → deploy em push pra `main`
- [ ] Build < 60s
- [ ] Notification Slack/Discord (opcional)
- [ ] Rollback documentado

## Soft launch

- [ ] Compartilhado com 5-10 pessoas próximas
- [ ] Feedback coletado e endereçado
- [ ] Sem erros 500 em logs nas últimas 24h

## Hard launch

- [ ] Bio Instagram atualizada
- [ ] Bio LinkedIn atualizada
- [ ] Post de launch agendado
- [ ] Email pra base existente preparado (se houver)
- [ ] Time avisado para responder leads em até 1 dia útil
