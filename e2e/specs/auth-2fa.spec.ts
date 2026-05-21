import { expect, test } from '@playwright/test';
import { generateSync } from 'otplib';

import { cleanupScenario, seedOwnerScenario, type E2EScenario } from '../helpers/auth';
import { disconnectPrisma } from '../helpers/db';

test.describe('Login + 2FA', () => {
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

  test('valida TOTP e chega no dashboard autenticado', async ({ page }) => {
    scenario = await seedOwnerScenario({ twoFactor: true });

    await page.goto('/login');
    await page.getByLabel('Usuario ou e-mail').fill(scenario.email);
    await page.getByLabel('Senha', { exact: true }).fill(scenario.password);
    await page.getByRole('button', { name: /^Entrar$/ }).click();

    await expect(page.getByRole('heading', { name: 'Confirme sua identidade' })).toBeVisible();

    const code = generateSync({ secret: scenario.totpSecret! });
    for (const [index, digit] of Array.from(code).entries()) {
      await page.getByLabel(`Codigo do app autenticador ${index + 1}`).fill(digit);
    }

    await page.getByRole('button', { name: /^Confirmar$/ }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { name: 'Painel Inicial' })).toBeVisible();
    await expect(page.getByText(scenario.username)).toBeVisible();
  });
});
