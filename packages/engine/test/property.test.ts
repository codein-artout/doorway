import { describe, it } from 'vitest';
import { Rng } from '../src/index';
import { DEFAULT_RULESET } from './helpers';
import { runs } from './property-helpers';

const pc = Rng.fromSeed('player-counts');
describe('Property tests (build spec §5.8)', () => {
  it('BS-5.8.3 BS-5.8.4 R11: 10,000 random 1–4p games end, keep invariants, replay deterministically, legalMoves ⟺ apply', () => {
    runs({ name: 'default', ruleset: DEFAULT_RULESET, players: () => 1 + pc.int(4) }, 10_000, 200);
  });
});
