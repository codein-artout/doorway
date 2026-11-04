import { describe, expect, it } from 'vitest';
import { STRATEGIES } from '../src/index';
import { winShare2p } from './helpers';

describe('Lookahead (determinized Monte Carlo)', () => {
  it('lookahead beats greedy in more than 60% of 2p games (160 games, default budget)', () => {
    expect(STRATEGIES.lookahead.params!.determinizations).toBe(16);
    const w = winShare2p('lookahead', 'greedy', 160, 'la-vs-greedy-');
    expect(w).toBeGreaterThan(0.6);
  });
});
