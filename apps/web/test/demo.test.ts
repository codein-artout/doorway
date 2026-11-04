import { describe, expect, it } from 'vitest';
import { currentPlayer, checkInvariants, turnOrder } from '@doorway/engine';
import { demoState } from '../src/lib/demo';

describe('v2 demo fixture (DESIGN-v2 §2)', () => {
  it('HIST0 is playable under the rules and reaches turn 22: Priya 11, Arun 12, Meera 13, Kavi 15, Priya to move', () => {
    const s = demoState();
    expect(s.players.map((p) => p.position)).toEqual([11, 12, 13, 15]);
    expect(s.turn).toBe(21);
    expect(currentPlayer(s)).toBe('p1');
    expect(turnOrder(s)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(checkInvariants(s)).toEqual([]);
    expect(s.market.young.slice().sort()).toEqual(['OR-Y5', 'PK-Y3', 'PU-Y3']);
  });
});
