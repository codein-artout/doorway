import { expect, test } from '@playwright/test';
import { expectNoSeriousA11y, startGame } from './helpers';

test.use({ viewport: { width: 360, height: 780 } });

test('360 px smoke: phone layout, no sideways page scroll, a move can be made', async ({ page }) => {
  await startGame(page);
  await expect(page.getByRole('tablist', { name: 'Card age' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.locator('[data-card][aria-disabled="false"]').first().click();
  await page.getByTestId('confirm').click();
  await expect(page.getByTestId('move-log')).toContainText('Priya took');
  await expectNoSeriousA11y(page, 'play@360');
  for (const url of ['/', '/rules', '/designer', '/designer/sandbox']) {
    await page.goto(url);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(o, url).toBeLessThanOrEqual(0);
  }
});
