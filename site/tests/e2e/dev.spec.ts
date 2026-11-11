import { expect, test } from '@playwright/test';

import { DEV_PORT } from '../../playwright.config';

test('production build ignores ?dev', async ({ page }) => {
  await page.goto('/?dev#pecat');
  await expect(page.locator('#panel-heading')).toHaveText('Суви печат');

  await expect(page.getByRole('region', { name: 'Developer tools' })).toHaveCount(0);
  await expect(page.locator('.verify')).toHaveCount(0);
});

test.describe('on the dev server', () => {
  test.use({ baseURL: `http://localhost:${String(DEV_PORT)}` });

  test.skip(
    ({ page }) => (page.viewportSize()?.width ?? 0) < 900,
    'dev tools are a desktop workflow',
  );

  test('dev mode: clicking the document moves the selected pin and updates the JSON', async ({
    page,
  }) => {
    await page.goto('/?dev');
    await expect(page.locator('.pin')).toHaveCount(9);
    const dev = page.getByRole('region', { name: 'Developer tools' });

    await dev.getByLabel('Target').selectOption('point:pecat');

    const pinBefore = await page.locator('.pin[data-id="pecat"]').boundingBox();
    const canvas = page.getByRole('application');
    const box = await canvas.boundingBox();

    await canvas.click({ position: { x: (box?.width ?? 0) * 0.4, y: (box?.height ?? 0) * 0.5 } });

    const json: unknown = JSON.parse(await dev.getByLabel('JSON').inputValue());

    expect(json).toMatchObject({
      points: expect.arrayContaining([
        expect.objectContaining({ id: 'pecat', pin: expect.any(Object) }),
      ]),
    });
    const pinAfter = await page.locator('.pin[data-id="pecat"]').boundingBox();

    expect(pinAfter?.y).not.toBe(pinBefore?.y);
  });

  test('dev mode: two clicks set a region', async ({ page }) => {
    await page.goto('/?dev');
    await expect(page.locator('.pin')).toHaveCount(9);
    const dev = page.getByRole('region', { name: 'Developer tools' });

    await dev.getByLabel('Mode').selectOption('region');
    const canvas = page.getByRole('application');

    await canvas.click({ position: { x: 500, y: 300 } });
    await expect(dev.locator('.dev__status')).toContainText('opposite corner');
    await canvas.click({ position: { x: 600, y: 400 } });

    await expect(dev.locator('.dev__status')).not.toContainText('opposite corner');
  });

  test('verify notes are only shown in dev mode', async ({ page }) => {
    await page.goto('/#pecat');
    await expect(page.locator('#panel-heading')).toHaveText('Суви печат');
    await expect(page.locator('.verify')).toHaveCount(0);

    await page.goto('/?dev#pecat');
    await expect(page.locator('.verify')).toBeVisible();
  });
});
