import { describe, expect, it } from 'vitest';
import { playGame } from '../src/index';
import { CARDS, DEFAULT_RULESET } from './helpers';

describe('Performance', () => {
  it('BS-5.8.5: 1,000 greedy bot-vs-bot 4p games run in under 10 s', () => {
    const seats = [0, 1, 2, 3].map(() => ({ policy: 'greedy' }));
    const t0 = performance.now();
    for (let g = 0; g < 1000; g++)
      playGame({ ruleset: DEFAULT_RULESET, cards: CARDS, seats, seed: 'perf' + g, stats: false });
    const ms = performance.now() - t0;
    console.log(`1,000 greedy 4p games: ${(ms / 1000).toFixed(2)} s`);
    expect(ms).toBeLessThan(10_000);
  });
});
