# Branch Protection

Task 5.6.6 precisa ser aplicada nas configurações do GitHub depois que o workflow `CI` rodar ao menos uma vez.

Configuração recomendada para `main`:

- Require a pull request before merging.
- Require approvals: `1` review.
- Require status checks to pass before merging.
- Required checks:
  - `audit`
  - `lint`
  - `type-check`
  - `test-backend`
  - `test-frontend`
  - `test-landing`
  - `coverage-comment`
  - `build`
- Não exigir `e2e` em todo PR enquanto ele roda apenas com label `e2e`; em `main`, ele roda automaticamente no push.
- Enable "Require branches to be up to date before merging" se o volume de PRs simultâneos aumentar.
- Enable "Do not allow bypassing the above settings" para administradores quando o projeto estiver em produção.
