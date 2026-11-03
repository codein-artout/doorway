// @doorway/content — the cards (loaded straight from spec/cards.json) and the built-in rulesets.

import cardsFile from '../../../spec/cards.json';
import defaultRuleset from '../rulesets/v0.2-default.json';
import type { Card, Ruleset } from '@doorway/engine';

export * from './schemas';

export const CARDS_FILE = cardsFile as unknown as {
  version: string;
  colors: Record<string, { domain: string; icon: string }>;
  cards: Card[];
};
export const CARDS: Card[] = CARDS_FILE.cards;
export const DEFAULT_RULESET: Ruleset = defaultRuleset as unknown as Ruleset;
export const DEFAULT_RULESET_ID = DEFAULT_RULESET.id;

export const BUILTIN_RULESETS: Record<string, Ruleset> = { [DEFAULT_RULESET.id]: DEFAULT_RULESET };

export function getRuleset(id: string): Ruleset {
  const r = BUILTIN_RULESETS[id];
  if (!r) throw new Error(`Unknown ruleset "${id}". Built-in: ${Object.keys(BUILTIN_RULESETS).join(', ')}`);
  return r;
}

export const DOMAIN_INFO = {
  pink: { name: 'Love', code: 'Lv', icon: 'heart' },
  gold: { name: 'Work', code: 'Wk', icon: 'hammer' },
  green: { name: 'Play', code: 'Pl', icon: 'kite' },
  orange: { name: 'Family', code: 'Fm', icon: 'house' },
  purple: { name: 'Wonder', code: 'Wd', icon: 'star' },
} as const;
