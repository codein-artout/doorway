import { describe, it } from 'vitest';
import { Rng } from '../src/index';
import { DEFAULT_RULESET, rules } from './helpers';
import { runs } from './property-helpers';

const pc = Rng.fromSeed('player-counts-variants');
describe('Property tests — variants', () => {
  it('R42: with minCost = 0 every game still ends (1,000 games)', () => {
    runs({ name: 'mincost0', ruleset: rules({ minCost: 0 }), players: () => 1 + pc.int(4) }, 1_000, 40);
  });
  it('R4: alternative Doorway arrays (10/7/5/3, 8/7/6/5, 3p 10/7/5, 2p 10/6) (1,000 games)', () => {
    const r = rules({ 'doorway.4': [10, 7, 5, 3], 'doorway.3': [10, 7, 5], 'doorway.2': [10, 6] });
    runs({ name: 'door-wide', ruleset: r, players: () => 2 + pc.int(3) }, 500, 50);
    runs({ name: 'door-flat', ruleset: rules({ 'doorway.4': [8, 7, 6, 5] }), players: () => 4 }, 500, 50);
  });
  it('R29: solo games (1,000 games)', () => {
    runs({ name: 'solo', ruleset: DEFAULT_RULESET, players: () => 1 }, 1_000, 40);
  });
});
