import { expect, test } from '@playwright/test';
import { expectNoSeriousA11y, playToEnd, startGame } from './helpers';

test('a full 2-player game against a bot at Instant speed', async ({ page }) => {
  await startGame(page);
  await expect(page.getByText('Your turn, Priya.')).toBeVisible();
  // preview + ghost before confirming
  const card = page.locator('[data-card][data-takeable="true"]').first();
  await card.click();
  await expect(page.getByTestId('preview')).toContainText('You move 0 →');
  await page.getByTestId('confirm').click();
  await expect(page.getByTestId('move-log')).toContainText('Priya took');
  // undo works locally
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('move-log')).not.toContainText('Priya took');
  await playToEnd(page);
  await expect(page.getByTestId('results')).toBeVisible();
  await expect(page.getByText(/brought the most through/)).toBeVisible();
  await expectNoSeriousA11y(page, 'results');
  // the replay of the finished game opens at the last move and steps back
  await page.getByRole('link', { name: 'Watch the replay' }).click();
  await expect(page.getByTestId('replay-pos')).toContainText('move');
  await page.getByTestId('replay-back').click();
  await expect(page).toHaveURL(/move=\d+/);
});

test('keyboard: R rushes, Esc clears, U undoes', async ({ page }) => {
  await startGame(page);
  await page.keyboard.press('r');
  await expect(page.getByTestId('confirm')).toContainText('Rush to');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('confirm')).toContainText('Choose a move');
  await page.keyboard.press('r');
  await page.keyboard.press('r');
  await expect(page.getByTestId('move-log')).toContainText('Priya rushed');
  await page.keyboard.press('u');
  await expect(page.getByTestId('move-log')).not.toContainText('Priya rushed');
});
