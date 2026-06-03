import { expect, test } from '@playwright/test';

import {
  cleanupScenario,
  e2eShopeeProductUrls,
  loginPageWithSession,
  loginViaApi,
  seedOwnerScenario,
  type E2EScenario
} from '../helpers/auth';
import { e2eConfig } from '../helpers/config';
import { disconnectPrisma } from '../helpers/db';

test.describe('Geracao de affiliate link', () => {
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

  test('gera 5 shortlinks Shopee em modo MOCK e exibe no historico', async ({ page, request }) => {
    scenario = await seedOwnerScenario();
    const session = await loginViaApi(request, scenario);

    await loginPageWithSession(page, session, '/affiliate-links');

    await expect(page.getByRole('heading', { name: 'Links de afiliado' })).toBeVisible();
    await page.getByLabel('Links originais').fill(e2eShopeeProductUrls.join('\n'));
    await page.getByLabel('sub_id1').fill(`campanha-${scenario.suffix}`);
    await page.getByRole('button', { name: /^Gerar$/ }).click();

    await expect(page.getByRole('heading', { name: 'Resultados da geracao' })).toBeVisible();
    await expect(page.getByText('https://br.shp.ee/').first()).toBeVisible();
    await page.getByRole('button', { name: 'Fechar' }).click();

    await expect(page.getByText('5 link(s) salvo(s) com sucesso.')).toBeVisible();
    await expect(page.getByText('5 registro(s)')).toBeVisible();

    const listResponse = await request.get(`${e2eConfig.backendURL}/api/affiliate-links?limit=10`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    });
    expect(listResponse.ok()).toBe(true);
    const body = (await listResponse.json()) as { links: Array<{ affiliateLink: string }> };
    expect(body.links).toHaveLength(5);
    expect(body.links.every((link) => link.affiliateLink.startsWith('https://br.shp.ee/'))).toBe(
      true
    );
  });
});
