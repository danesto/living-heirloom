import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function audit(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    // OpenSeadragon's minimap canvas is decorative and not keyboard-operable by design.
    .exclude('.navigator')
    // Pins can sit underneath the phone bottom sheet, which axe reports as overlapping
    // targets. Their own 44×44 px size is asserted separately below.
    .disableRules(['target-size'])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );

  expect(summary).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test('contents view has no accessibility violations', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.pin')).toHaveCount(9);
      await audit(page);
    });

    test('point view has no accessibility violations', async ({ page }) => {
      await page.goto('/#ukaz');
      await expect(page.locator('#panel-heading')).toHaveText('Указ о одликовању');
      await audit(page);
    });

    test('transcription view has no accessibility violations', async ({ page }) => {
      await page.goto('/');
      await page.locator('.toolbar .tool', { hasText: 'Транскрипција' }).click();
      await expect(page.locator('.line').first()).toBeVisible();
      await audit(page);
    });
  });
}

test('every pin has at least a 44×44 px touch target', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.pin')).toHaveCount(9);

  for (const pin of await page.locator('.pin').all()) {
    const box = await pin.boundingBox();

    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test('keyboard zoom and pan change the view; 0 returns home', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 900, 'needs the minimap to observe the view');
  await page.goto('/');
  await expect(page.locator('.pin')).toHaveCount(9);
  const region = page.locator('.navigator .displayregion');
  const width = async (): Promise<number> => (await region.boundingBox())?.width ?? 0;
  const initial = await width();

  await page.getByRole('application').focus();
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await expect.poll(width).toBeLessThan(initial * 0.8);

  const before = (await region.boundingBox())?.x ?? 0;

  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await region.boundingBox())?.x ?? 0).toBeGreaterThan(before);

  await page.keyboard.press('0');
  await expect.poll(width).toBeCloseTo(initial, -1);
});

test('reduced motion: fly-to jumps immediately', async ({ browser }) => {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  await page.goto('/');
  await expect(page.locator('.pin')).toHaveCount(9);
  const region = page.locator('.navigator .displayregion');
  const initial = (await region.boundingBox())?.width ?? 0;

  await page.locator('.pin[data-id="pecat"]').click();
  // Two animation frames are enough when there is no animation.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );

  expect((await region.boundingBox())?.width ?? 0).toBeLessThan(initial * 0.6);
  await context.close();
});
