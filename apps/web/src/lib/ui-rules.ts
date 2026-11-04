// Small, testable UI rules from RULINGS R34, R35, R38, R39, R41 and the rulebook's hint mode.

import { ageIndex, ageOf, AGES, type Age, type Ruleset } from '@doorway/engine';

/** R34: pawns are ivory with the player's initial; bots get a dashed ring; the current pawn pulses. Never domain colours. */
export function pawnStyle(o: { isBot: boolean; current: boolean; ghost?: boolean }) {
  return {
    background: o.ghost ? 'transparent' : 'var(--text)',
    color: o.ghost ? 'var(--door)' : 'var(--ground)',
    border: o.ghost ? '2px dashed var(--door)' : 'none',
    outline: o.isBot && !o.ghost ? '2px dashed var(--muted)' : 'none',
    pulse: o.current && !o.ghost,
  };
}

export function initialOf(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

/** R39: bot speed. Normal is the default. */
export const BOT_SPEEDS = { slow: 2000, normal: 1000, instant: 0 } as const;
export type BotSpeed = keyof typeof BOT_SPEEDS;
export const DEFAULT_BOT_SPEED: BotSpeed = 'normal';

/** R35: hint mode is on by default; Blind test turns off the best-window hint and all first-game hints. */
export function hintSettings(ruleset: Ruleset, blind: boolean) {
  return {
    bestWindow: !blind && ruleset.hints.bestWindow,
    firstGameTips: !blind,
    /** the live score preview always updates, even in blind mode */
    liveScore: true,
  };
}

/** R38: on phones the market shows one age per tab; the default tab is the player's own age. */
export function marketTabs(ruleset: Ruleset, position: number) {
  const mine = ageOf(ruleset, position) ?? 'old';
  return {
    defaultTab: mine as Age,
    tabs: AGES.map((age) => {
      const open = ageIndex(age) <= ageIndex(mine);
      const name = age[0].toUpperCase() + age.slice(1);
      return { age, open, label: open ? name : `${name} · at ${ruleset.ageBands[age][0]}` };
    }),
  };
}

/** R41: the colour-blind palette is just another token set on <html data-palette>. */
export type Palette = 'standard' | 'colorblind';
export function applyPalette(p: Palette) {
  if (typeof document !== 'undefined') document.documentElement.dataset.palette = p;
}

/** R46: the product name. */
export const APP_NAME = 'Doorway';
