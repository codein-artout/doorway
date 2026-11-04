// v2 — Board and Analyst views (BUILD_PROMPT-v2 §N9).
import { expect, test } from '@playwright/test';
import { expectNoSeriousA11y } from './helpers';
import { playToEndIn, startGameIn, switchView, type View } from './helpers-v2';

for (const view of ['board', 'analyst'] as View[]) {
  test(`${view}: a full 2-player game against a bot at Instant speed, Doorway and results`, async ({
    page,
  }) => {
    await startGameIn(page, view);
    await expect(page.getByTestId('turn-banner')).toHaveText(/Your turn, Priya\./);
    const res = await playToEndIn(page, view, async () => {
      await expect(page.getByTestId('doorway-select')).toBeVisible();
      await expect(page.getByTestId('doorway-total')).toHaveText(/\d+/);
      await expectNoSeriousA11y(page, `${view} doorway`);
    });
    expect(res.doorwaySeen).toBe(true);
    await expect(page.getByTestId('results')).toBeVisible();
    await expect(page.locator('[data-testid^="total-"]').first()).toHaveText(/\d+/);
    if (view === 'analyst') {
      await expect(page.getByTestId('kpis')).toContainText('Winner');
      await expect(page.getByTestId('final-table')).toBeVisible();
      await expect(page.getByTestId('played-like')).toContainText('decisions');
      await expect(page.getByTestId('vs-study')).toContainText('Turns per game');
      // study numbers are filled from reports/data/summary.json
      await expect(page.getByTestId('vs-study').locator('td').nth(2)).toHaveText(/\d/);
    } else {
      await expect(page.getByText(/brought the most through/)).toBeVisible();
    }
    await expectNoSeriousA11y(page, `${view} results`);
    // the replay viewer opens in the same view
    await page.getByRole('link', { name: 'Watch the replay' }).click();
    await expect(page.getByTestId(view === 'board' ? 'replay-board' : 'replay-analyst')).toBeVisible();
    await page.getByTestId('replay-back').click();
    await expect(page).toHaveURL(/move=\d+/);
    await expectNoSeriousA11y(page, `${view} replay`);
  });
}

test('switching views mid-game keeps the game and the selected move', async ({ page }) => {
  await page.goto('/play?demo=1&speed=instant');
  await expect(page.getByTestId('board-table')).toBeVisible();
  // select Dance badly at a wedding on the Board
  await page.locator('[data-card="PK-Y3"]').click();
  await expect(page.getByTestId('confirm')).toBeEnabled();
  await switchView(page, 'analyst');
  await expect(page.getByTestId('row-PK-Y3')).toHaveAttribute('style', /highlight/);
  await expect(page.getByTestId('pick-PK-Y3')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('preview')).toHaveText(
    'PK-Y3 · cost 2 (3 − Love 1) · 11→13 · next: Arun 12 · you stack on top · Δ now +5',
  );
  await expect(page.getByTestId('queue-after')).toContainText('after: Arun 12 → Priya 13');
  await expect(page.getByTestId('ruler-ghost')).toBeVisible();
  await expectNoSeriousA11y(page, 'analyst table, row selected');
  // the V key flips back; still selected
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('v');
  await expect(page.locator('html')).toHaveAttribute('data-view', 'board');
  await expect(page.locator('[data-card="PK-Y3"]')).toHaveAttribute('aria-pressed', 'true');
  // play it in the Board, check it in the Analyst
  await page.getByTestId('confirm').click();
  await switchView(page, 'analyst');
  await expect(page.getByTestId('event-log')).toContainText('Dance badly at a wedding');
  await expect(page.getByTestId('ledger')).toContainText('Priya');
  await expect(page.getByTestId('why')).toContainText('Why');
  // a reload keeps the view and the game
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-view', 'analyst');
  await expect(page.getByTestId('event-log')).toContainText('Dance badly at a wedding');
});

test('the Doorway: the stretch under consideration survives a view switch', async ({ page }) => {
  await startGameIn(page, 'analyst', 'e2e-door');
  let checked = false;
  await playToEndIn(page, 'analyst', async () => {
    // pick the first window in the Analyst scorer, then look at it on the Board
    await page.getByTestId('window-0').click();
    const total = (await page.getByTestId('doorway-total').textContent())!.trim();
    await switchView(page, 'board');
    await expect(page.getByTestId('doorway-select')).toBeVisible();
    await expect(page.getByTestId('doorway-total')).toHaveText(new RegExp(`^${total}$`));
    await switchView(page, 'analyst');
    await expect(page.getByTestId('window-0')).toHaveAttribute('aria-pressed', 'true');
    checked = true;
  });
  expect(checked).toBe(true);
});

test.describe('360 px in both views', () => {
  test.use({ viewport: { width: 360, height: 780 } });
  for (const view of ['board', 'analyst'] as View[])
    test(`${view}: no sideways page scroll, a move can be made`, async ({ page }) => {
      await startGameIn(page, view, 'e2e-phone');
      const over = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(await over()).toBeLessThanOrEqual(0);
      if (view === 'board') await page.locator('[data-card][aria-disabled="false"]').first().click();
      else await page.locator('[data-testid^="pick-"]:not([disabled])').first().click();
      await page.getByTestId('confirm').first().click();
      expect(await over()).toBeLessThanOrEqual(0);
      await expectNoSeriousA11y(page, `play@360 ${view}`);
      for (const url of ['/', '/rules', '/replay', '/designer', '/designer/sandbox', '/designer/cards']) {
        await page.goto(url);
        expect(await over(), `${url} ${view}`).toBeLessThanOrEqual(0);
      }
    });
});

const PAGES = ['/', '/rules', '/replay', '/design-check', '/play?demo=1&speed=instant'];
for (const view of ['board', 'analyst'] as View[])
  for (const url of PAGES)
    test(`axe (${view}): ${url}`, async ({ page }) => {
      await page.goto(`${url}${url.includes('?') ? '&' : '?'}view=${view}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('html')).toHaveAttribute('data-view', view);
      await expectNoSeriousA11y(page, `${url} (${view})`);
    });

for (const url of ['/designer', '/designer/sandbox', '/designer/cards'])
  test(`axe: ${url} is always Analyst, even when Board is chosen`, async ({ page }) => {
    await page.goto(`${url}?view=board`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-view="analyst"]').first()).toBeVisible();
    await expect(page.getByTestId('view-switch')).toHaveCount(0);
    await expectNoSeriousA11y(page, url);
  });
