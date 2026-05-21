import { expect, test, type Page } from '@playwright/test';

import {
  cleanupScenario,
  e2eShopeeProductUrls,
  seedOwnerScenario,
  type E2EScenario
} from '../helpers/auth';
import { disconnectPrisma, getPrisma } from '../helpers/db';
import { e2eConfig } from '../helpers/config';

const mockShopeeDestination = async (page: Page): Promise<void> => {
  await page.route('https://shopee.mock/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Shopee Mock</title><h1>Shopee Mock</h1>'
    });
  });
};

const submitPublicConversion = async (page: Page, url: string): Promise<void> => {
  await page.getByLabel('Link da Shopee').fill(url);
  await page.getByRole('button', { name: 'Preparar meu link' }).click();
};

test.describe('Modulo Alli publico', () => {
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

  test('converte URL longa Shopee com sucesso e redireciona para o shortlink', async ({ page }) => {
    scenario = await seedOwnerScenario();

    await mockShopeeDestination(page);
    await page.route('**/api/public/convert', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    });

    await page.goto(`/p/${scenario.companySlug}`);
    await expect(
      page.getByRole('heading', { name: 'Landing E2E de ofertas Shopee' })
    ).toBeVisible();

    await submitPublicConversion(page, e2eShopeeProductUrls[0]);

    await expect(page.getByText('Buscando melhores cupons...')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cupom aplicado!' })).toBeVisible();
    await expect(page).toHaveURL(/https:\/\/shopee\.mock\/s\//, { timeout: 6_000 });
    await expect(page.getByRole('heading', { name: 'Shopee Mock' })).toBeVisible();
  });

  test('expande shortlink Shopee e conclui a conversao em modo mock', async ({ page }) => {
    scenario = await seedOwnerScenario();

    await mockShopeeDestination(page);

    await page.goto(`/p/${scenario.companySlug}`);
    await submitPublicConversion(page, 'https://shope.ee/e2eShort01?utm_source=instagram');

    await expect(page.getByRole('heading', { name: 'Cupom aplicado!' })).toBeVisible();
    await expect(page).toHaveURL(/https:\/\/shopee\.mock\/s\//, { timeout: 6_000 });
  });

  test('exibe erro inline para URL invalida sem chamar a API publica', async ({ page }) => {
    scenario = await seedOwnerScenario();
    let convertCalled = false;

    await page.route('**/api/public/convert', async (route) => {
      convertCalled = true;
      await route.continue();
    });

    await page.goto(`/p/${scenario.companySlug}`);
    await submitPublicConversion(page, 'https://example.com/produto');

    await expect(page.getByText('Use um link valido da Shopee.')).toBeVisible();
    expect(convertCalled).toBe(false);
  });

  test('trata honeypot como sucesso fake e persiste BOT_DETECTED', async ({ request }) => {
    scenario = await seedOwnerScenario();

    const response = await request.post(`${e2eConfig.backendURL}/api/public/convert`, {
      data: {
        url: e2eShopeeProductUrls[1],
        companySlug: scenario.companySlug,
        website: 'bot-filled-field'
      }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 'success',
      affiliateUrl: scenario ? 'https://shopee.mock/fallback' : expect.any(String),
      conversionId: expect.any(String)
    });

    const botDetectedCount = await getPrisma().conversion.count({
      where: {
        companyId: scenario.companyId,
        status: 'BOT_DETECTED'
      }
    });
    expect(botDetectedCount).toBe(1);
  });

  test('aplica URL de fallback quando a Shopee mockada falha', async ({ request }) => {
    scenario = await seedOwnerScenario();

    const response = await request.post(`${e2eConfig.backendURL}/api/public/convert`, {
      data: {
        url: 'https://shopee.com.br/product/10001/20004?e2e-force-fallback=1',
        companySlug: scenario.companySlug
      }
    });

    expect(response.status()).toBe(200);
    await expect(response).toBeOK();
    const body = await response.json();
    expect(body).toMatchObject({
      status: 'fallback',
      affiliateUrl: 'https://shopee.mock/fallback',
      conversionId: expect.any(String)
    });
  });

  test('mostra 404 para slug de empresa inexistente', async ({ page }) => {
    await page.goto('/p/e2e-slug-inexistente');

    await expect(page.getByRole('heading', { name: 'Landing nao encontrada.' })).toBeVisible();
  });

  test('employee slug invalido registra conversao direta', async ({ request }) => {
    scenario = await seedOwnerScenario();

    const response = await request.post(`${e2eConfig.backendURL}/api/public/convert`, {
      data: {
        url: e2eShopeeProductUrls[2],
        companySlug: scenario.companySlug,
        employeeSlug: 'criador-inexistente'
      }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 'success',
      conversionId: expect.any(String)
    });

    const conversion = await getPrisma().conversion.findFirst({
      where: {
        id: body.conversionId
      },
      select: {
        id: true,
        employeeId: true,
        status: true
      }
    });

    expect(conversion).toEqual({
      id: body.conversionId,
      employeeId: null,
      status: 'SUCCESS'
    });
  });
});
