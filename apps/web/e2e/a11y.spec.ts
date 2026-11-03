import { expect, test } from '@playwright/test';
import { expectNoSeriousA11y, startGame } from './helpers';

for (const url of [
  '/',
  '/rules',
  '/replay',
  '/designer',
  '/designer/sandbox',
  '/designer/cards',
  '/design-check',
])
  test(`axe: ${url} has no serious or critical violations`, async ({ page }) => {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await expectNoSeriousA11y(page, url);
  });

test('axe: the table and the Doorway', async ({ page }) => {
  await startGame(page);
  await expectNoSeriousA11y(page, '/play');
  await page.getByTestId('rules-toggle').click();
  await expectNoSeriousA11y(page, '/play+rules');
});

test('sandbox: change a dial, run a smoke batch, save a ruleset that appears on the New game screen', async ({
  page,
}) => {
  await page.goto('/designer/sandbox');
  await page.getByTestId('inc-fullLifeBonus').click();
  await expect(page.getByTestId('diff')).toContainText('fullLifeBonus');
  await page.getByTestId('games').selectOption('100');
  await page.getByTestId('run').click();
  await expect(page.getByTestId('comparison')).toBeVisible({ timeout: 120_000 });
  await page.getByTestId('ruleset-name').fill('e2e-variant');
  await page.getByTestId('save-ruleset').click();
  await page.goto('/');
  await expect(page.getByTestId('ruleset').locator('option', { hasText: 'e2e-variant' })).toHaveCount(1);
});
