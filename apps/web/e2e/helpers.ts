import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export async function startGame(page: Page, opts: { speed?: string } = {}) {
  await page.goto('/');
  await page.getByTestId('speed').selectOption(opts.speed ?? 'instant');
  await page.getByTestId('seed').fill('e2e-seed');
  await page.getByTestId('start').click();
  await page.waitForURL(/\/play/, { waitUntil: 'commit' });
  await expect(page.getByTestId('turn-banner')).toBeVisible();
}

/** Play the human seat until the game is over: quests when possible, else rush; skip swaps; walk through. */
export async function playToEnd(page: Page, maxSteps = 400) {
  for (let i = 0; i < maxSteps; i++) {
    if (
      await page
        .getByTestId('results')
        .isVisible()
        .catch(() => false)
    )
      return;
    if (
      await page
        .getByTestId('walk-through')
        .isVisible()
        .catch(() => false)
    ) {
      await page.getByTestId('walk-through').click();
      await page.waitForTimeout(1200);
      continue;
    }
    if (
      await page
        .getByTestId('skip-swap')
        .isVisible()
        .catch(() => false)
    ) {
      await page.getByTestId('skip-swap').click();
      continue;
    }
    const confirm = page.getByTestId('confirm');
    if (await confirm.isVisible().catch(() => false)) {
      const card = page.locator('[data-card][data-takeable="true"][aria-disabled="false"]').first();
      if (await card.count()) await card.click();
      else await page.getByTestId('mode-rush').click();
      if (await confirm.isEnabled().catch(() => false)) {
        await confirm.click();
        continue;
      }
    }
    await page.waitForTimeout(100);
  }
  throw new Error('game did not finish');
}

export async function expectNoSeriousA11y(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    bad.map(
      (v) =>
        `${label}: ${v.id} (${v.impact}) ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(' '))
          .join(' | ')}`,
    ),
  ).toEqual([]);
}
