import { describe, expect, it } from 'vitest';
import { STRATEGY_IDS } from '../src/index';
import { winShare2p } from './helpers';

// spec §13: every archetype beats random more than 90% of the time (2p, seats alternated)
describe('Strength vs random (spec §13)', () => {
  for (const id of STRATEGY_IDS.filter((x) => x !== 'random' && x !== 'lookahead'))
    it(`${id} beats random in > 90% of 2p games (300 games)`, () => {
      expect(winShare2p(id, 'random', 300, `vr-${id}-`)).toBeGreaterThan(0.9);
    });
  it('lookahead beats random in > 90% of 2p games (60 games)', () => {
    expect(winShare2p('lookahead', 'random', 60, 'vr-la-')).toBeGreaterThan(0.9);
  });
});
