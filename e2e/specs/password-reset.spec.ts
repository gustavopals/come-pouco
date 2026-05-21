import { expect, test } from '@playwright/test';

import { cleanupScenario, seedOwnerScenario, type E2EScenario } from '../helpers/auth';
import { disconnectPrisma } from '../helpers/db';
import {
  clearMailpitInbox,
  configureMailpitEmail,
  waitForPasswordResetLink
} from '../helpers/mailpit';

test.describe('Reset de senha via Mailpit', () => {
  let scenario: E2EScenario | null = null;

  test.afterEach(async () => {
    if (scenario) {
      await cleanupScenario(scenario);
      scenario = null;
    }
  });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test('requisita reset, lê e-mail, redefine senha e faz login', async ({ page }) => {
    scenario = await seedOwnerScenario();
    const newPassword = 'E2eNewPass987!';

    await configureMailpitEmail();
    await clearMailpitInbox();
    await page.setExtraHTTPHeaders({
      'X-Forwarded-For': `10.55.0.${Number.parseInt(scenario.suffix.slice(0, 2), 16)}`
    });

    await page.goto('/forgot-password');
    await page.getByLabel('E-mail').fill(scenario.email);
    await page.getByRole('button', { name: 'Enviar link' }).click();

    await expect(page.getByRole('heading', { name: 'Verifique seu e-mail' })).toBeVisible();
    const resetLink = await waitForPasswordResetLink(scenario.email);

    await page.goto(resetLink);
    await page.getByLabel('Nova senha').fill(newPassword);
    await page.getByRole('button', { name: 'Redefinir senha' }).click();
    await expect(page.getByText('Senha redefinida com sucesso.')).toBeVisible();

    await page.goto('/login');
    await page.getByLabel('Usuario ou e-mail').fill(scenario.email);
    await page.getByLabel('Senha', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: /^Entrar$/ }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { name: 'Painel Inicial' })).toBeVisible();
  });
});
