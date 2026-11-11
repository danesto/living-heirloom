import { expect, test, type Page } from '@playwright/test';

const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 0) < 900;

async function open(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await expect(page.locator('.pin')).toHaveCount(9);
}

test('loads the document with numbered pins and the contents list', async ({ page }) => {
  await open(page);

  await expect(page).toHaveTitle(/Албанска споменица/);
  await expect(page.locator('.pin').first()).toHaveAccessibleName('1. Албанска споменица');
  await expect(page.locator('.toc__item')).toHaveCount(9);
  await expect(page.locator('#status')).toHaveCount(0);
});

test('clicking a pin selects it, updates the hash and highlights the region', async ({ page }) => {
  await open(page);
  const pin = page.locator('.pin[data-id="pecat"]');

  await pin.click();

  await expect(page).toHaveURL(/#pecat$/);
  await expect(pin).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#panel-heading')).toHaveText('Суви печат');
  await expect(page.locator('.region--point')).toHaveClass(/is-visible/);
});

test('deep link opens the point', async ({ page }) => {
  await open(page, '/#ukaz');

  await expect(page.locator('#panel-heading')).toHaveText('Указ о одликовању');
  await expect(page.locator('.pin[data-id="ukaz"]')).toHaveAttribute('aria-current', 'true');
});

test('guided tour goes top to bottom with previous/next', async ({ page }) => {
  await open(page);

  await page.locator('.toolbar .tool', { hasText: 'Обилазак' }).click();
  await expect(page.locator('#panel-heading')).toHaveText('Албанска споменица');
  await expect(page.locator('.tour-nav__previous')).toBeDisabled();

  await page.locator('.tour-nav__next').click();
  await expect(page.locator('#panel-heading')).toHaveText('Краљ Александар I');
  await expect(page.locator('.eyebrow')).toHaveText('Ознака 2 од 9');

  await page.locator('.tour-nav__previous').click();
  await expect(page.locator('#panel-heading')).toHaveText('Албанска споменица');
});

test('transcription lines zoom to their place', async ({ page }) => {
  await open(page);

  await page.locator('.toolbar .tool', { hasText: 'Транскрипција' }).click();
  const line = page.locator('[data-line="naslov-2"]');

  await line.click();

  await expect(line).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.region--line')).toHaveClass(/is-visible/);
  await expect(page.locator('.line--placeholder')).toHaveCount(2);
});

test('script toggle switches to Latin and is remembered', async ({ page }) => {
  await open(page);

  await page.locator('.tool--script').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'sr-Latn');
  await expect(page.locator('.toc__item').first()).toHaveText(/Albanska spomenica/);

  await page.reload();
  await expect(page.locator('.pin').first()).toHaveAccessibleName('1. Albanska spomenica');
});

test('pins can be hidden', async ({ page }) => {
  await open(page);

  await page.locator('.toolbar .tool', { hasText: 'Сакриј ознаке' }).click();

  await expect(page.locator('.pin').first()).toBeHidden();
});

test('escape closes the panel', async ({ page }) => {
  await open(page, '/#pecat');

  await page.keyboard.press('Escape');

  await expect(page.locator('#panel')).toBeHidden();
  await expect(page).not.toHaveURL(/#/);
});

test('invalid data shows an error instead of a broken page', async ({ page }) => {
  await page.route('**/points.json', (route) => route.fulfill({ json: { points: [{ id: 'X' }] } }));
  await page.goto('/');

  await expect(page.locator('#status')).toHaveText(/није могуће учитати.*points\.json/);
});

test.describe('desktop only', () => {
  test.skip(({ page }) => isPhone(page), 'desktop layout');

  test('shows the minimap and zoom buttons, panel on the right', async ({ page }) => {
    await open(page);

    await expect(page.locator('.navigator')).toBeVisible();
    await expect(page.locator('.zoom-controls')).toBeVisible();
    const box = await page.locator('#panel').boundingBox();

    expect(box?.x).toBeGreaterThan(900);
  });

  test('keyboard: Tab reaches pins in reading order, Enter selects', async ({ page }) => {
    await open(page);
    await page.getByRole('application').focus();

    await page.keyboard.press('Tab');
    await expect(page.locator('.pin').first()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('.pin').nth(1)).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.locator('#panel-heading')).toHaveText('Краљ Александар I');
  });
});

test.describe('phone only', () => {
  test.skip(({ page }) => !isPhone(page), 'phone layout');

  test('uses a bottom sheet and hides the minimap', async ({ page }) => {
    await open(page);

    await expect(page.locator('.navigator')).toBeHidden();
    await expect(page.locator('.zoom-controls')).toBeHidden();
    const box = await page.locator('#panel').boundingBox();

    expect(box?.x).toBe(0);
    // Peeking: the tabs are visible, the content is not.
    expect(box?.height).toBeGreaterThan(60);
    expect(box?.height).toBeLessThan(160);
    await expect(page.locator('#panel .tab').first()).toBeInViewport();
  });

  test('selecting a pin raises the sheet to show the details', async ({ page }) => {
    await open(page);
    const viewport = page.viewportSize();

    await page.locator('.pin[data-id="medalja"]').tap();

    await expect(page.locator('#panel-heading')).toBeInViewport();
    await expect(page.locator('.tour-nav__next')).toBeInViewport();
    const panel = await page.locator('#panel').boundingBox();

    expect(panel?.y).toBeLessThan((viewport?.height ?? 0) * 0.6);
  });
});
