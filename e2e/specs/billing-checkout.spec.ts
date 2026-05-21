import { test } from '@playwright/test';

test.describe('Billing checkout', () => {
  test.skip('checkout Stripe depende da Fase 7, que ainda nao existe no codigo atual', async () => {
    // Task 5.5 reserva este spec para o fluxo Free -> Pro -> plano ativo.
    // Remover o skip quando os endpoints /api/billing/* e a tela /my-company/billing forem entregues.
  });
});
