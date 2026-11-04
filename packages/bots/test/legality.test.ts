import { describe, expect, it } from 'vitest';
import { getPolicy, playGame, STRATEGY_IDS } from '../src/index';
import { CARDS, DEFAULT_RULESET, strict } from './helpers';
import { Rng } from '@doorway/engine';

// No bot ever submits an illegal move: 1,000 games per strategy (2–4 players, mixed opponents).
// The lookahead bot runs at a reduced budget here (2 determinizations) so the suite stays fast;
// its move generation is identical at any budget.
describe('No illegal moves', () => {
  for (const id of STRATEGY_IDS)
    it(`${id} never submits an illegal move (1,000 games)`, () => {
      const rng = Rng.fromSeed('legal-' + id);
      const others = STRATEGY_IDS.filter((x) => x !== 'lookahead');
      const mk = (p: string) =>
        strict(
          getPolicy(p, p === 'lookahead' ? { params: { determinizations: 1, maxCandidates: 3 } } : undefined),
        );
      for (let g = 0; g < 1000; g++) {
        const n = 2 + (g % 3);
        const seats = [
          { policy: id },
          ...Array.from({ length: n - 1 }, () => ({ policy: rng.pick(others) })),
        ];
        const r = playGame({
          ruleset: DEFAULT_RULESET,
          cards: CARDS,
          seats,
          seed: `legal-${id}-${g}`,
          policies: seats.map((x) => mk(x.policy)),
          stats: false,
        });
        expect(r.state.phase).toBe('over');
      }
    });
  it('noisy variants never submit an illegal move (200 games each of tempo@eps0.25, specialist@eps0.08)', () => {
    for (const id of ['tempo@eps0.25', 'specialist@eps0.08']) {
      for (let g = 0; g < 200; g++) {
        const seats = [{ policy: id }, { policy: 'greedy' }, { policy: 'random' }];
        playGame({
          ruleset: DEFAULT_RULESET,
          cards: CARDS,
          seats,
          seed: `noisy-${id}-${g}`,
          policies: seats.map((x) => strict(getPolicy(x.policy))),
          stats: false,
        });
      }
    }
  });
});
