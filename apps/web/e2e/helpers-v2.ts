import { expect, type Page } from '@playwright/test';

export type View = 'board' | 'analyst';

/** New 2-player game against a bot at Instant speed, in the given view. */
export async function startGameIn(page: Page, view: View, seed = 'e2e-v2') {
  await page.goto(`/?view=${view}`);
  await page.getByTestId('speed').selectOption('instant');
  await page.getByTestId('seed').fill(seed);
  await page.getByTestId('start').click();
  await page.waitForURL(/\/play/, { waitUntil: 'commit' });
  await expect(page.locator('html')).toHaveAttribute('data-view', view);
  const phone = (page.viewportSize()?.width ?? 1280) < 768;
  await expect(
    page.getByTestId(view === 'analyst' ? 'analyst-table' : phone ? 'board-phone' : 'board-table'),
  ).toBeVisible();
}

export async function switchView(page: Page, view: View) {
  await page.getByTestId(`view-${view}`).first().click();
  await expect(page.locator('html')).toHaveAttribute('data-view', view);
}

const visible = (page: Page, id: string) =>
  page
    .getByTestId(id)
    .first()
    .isVisible()
    .catch(() => false);

/**
 * Play the human seat to the end in either view: take the first legal quest, else rush; skip swaps; lock the
 * window offered at the Doorway. `onDoorway` runs once, the first time a Doorway screen appears.
 */
export async function playToEndIn(page: Page, view: View, onDoorway?: () => Promise<void>, maxSteps = 500) {
  let doorwaySeen = false;
  for (let i = 0; i < maxSteps; i++) {
    if (await visible(page, 'results')) return { doorwaySeen };
    if (await visible(page, 'walk-through')) {
      if (!doorwaySeen) {
        doorwaySeen = true;
        if (onDoorway) await onDoorway();
      }
      if (await visible(page, 'walk-through')) {
        await page.getByTestId('walk-through').first().click();
        await page.waitForTimeout(view === 'board' ? 1200 : 200);
      }
      continue;
    }
    if (await visible(page, 'skip-swap')) {
      await page.getByTestId('skip-swap').click();
      continue;
    }
    const confirm = page.getByTestId('confirm').first();
    if (await confirm.isVisible().catch(() => false)) {
      if (view === 'board') {
        const card = page.locator('[data-card][data-takeable="true"][aria-disabled="false"]').first();
        if (await card.count()) await card.click();
        else await page.getByTestId('mode-rush').first().click();
      } else {
        const row = page.locator('[data-testid^="pick-"]:not([disabled])').first();
        if (await row.count()) await row.click();
      }
      if (await confirm.isEnabled().catch(() => false)) {
        await confirm.click();
        continue;
      }
    }
    await page.waitForTimeout(80);
  }
  throw new Error('game did not finish');
}
