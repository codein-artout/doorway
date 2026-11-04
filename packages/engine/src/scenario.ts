// Scenario helper for scripted tests and tutorials: build an exact market, decks and player state.

import { init } from './engine';
import type { Age, Card, GameState, PlayerId, PlayerSetup, PlayerState, Ruleset } from './types';
import { AGES } from './types';

export type ScenarioSpec = {
  seed?: string;
  /** exact market rows; null = empty slot */
  market?: Partial<Record<Age, (string | null)[]>>;
  /** top-of-deck order; cards not named anywhere follow in cards.json order */
  decks?: Partial<Record<Age, string[]>>;
  /** per-player overrides (towers' cards are removed from decks/market automatically) */
  players?: Record<PlayerId, Partial<Omit<PlayerState, 'id' | 'seat'>>>;
  /** explicit stacks (space → bottom..top). Required if you move pawns off space 0. */
  stacks?: Record<number, PlayerId[]>;
  discard?: string[];
};

export function scenario(
  ruleset: Ruleset,
  cards: Card[],
  seats: PlayerSetup[],
  spec: ScenarioSpec = {},
): GameState {
  const s = init(ruleset, cards, seats, spec.seed ?? 'scenario');
  const used = new Set<string>();
  const take = (id: string) => {
    if (!s.cards[id]) throw new Error(`scenario: unknown card ${id}`);
    if (used.has(id)) throw new Error(`scenario: card ${id} placed twice`);
    used.add(id);
  };
  for (const [pid, o] of Object.entries(spec.players ?? {})) {
    const p = s.players.find((x) => x.id === pid);
    if (!p) throw new Error(`scenario: unknown player ${pid}`);
    Object.assign(p, JSON.parse(JSON.stringify(o)));
  }
  for (const p of s.players) p.tower.forEach(take);
  for (const id of spec.discard ?? []) take(id);
  s.discard = (spec.discard ?? []).slice();
  for (const age of AGES) {
    if (spec.market?.[age]) {
      const row = spec.market[age]!;
      if (row.length !== ruleset.market[age])
        throw new Error(`scenario: market.${age} needs ${ruleset.market[age]} slots`);
      row.forEach((id) => id && take(id));
    }
  }
  for (const age of AGES) for (const id of spec.decks?.[age] ?? []) take(id);
  for (const age of AGES) {
    const rest = cards.filter((c) => c.age === age && !used.has(c.id)).map((c) => c.id);
    let market: (string | null)[];
    if (spec.market?.[age]) market = spec.market[age]!.slice();
    else {
      market = [];
      for (let i = 0; i < ruleset.market[age]; i++) market.push(rest.shift() ?? null);
    }
    s.market[age] = market;
    s.decks[age] = [...(spec.decks?.[age] ?? []), ...rest];
  }
  if (spec.stacks) {
    s.stacks = {};
    for (const [k, v] of Object.entries(spec.stacks)) s.stacks[Number(k)] = v.slice();
  } else if (spec.players && Object.values(spec.players).some((o) => o.position !== undefined)) {
    // rebuild stacks: seat order (seat 1 on top) per space
    s.stacks = {};
    for (const p of s.players.slice().reverse()) (s.stacks[p.position] ??= []).push(p.id);
  }
  s.log = s.log.slice(0, 1);
  return s;
}
