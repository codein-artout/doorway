import { describe, expect, it } from 'vitest';
import { bestWindow, costBreakdown, score, scoreWindow } from '../src/index';
import { P, cur, play, q, rush, scen, skipSwaps } from './helpers';

// Rulebook §16, scripted exactly. Seats: p1 Priya (top), p2 Arun, p3 Meera.
describe('RB-16 BS-5.8.2: the rulebook §16 worked example', () => {
  it('RB-16: opening turns — stack order, turn order, the Rush discard', () => {
    let s = scen(3, {
      market: { young: ['PK-Y5', 'GR-Y2', 'PU-Y1'] },
      decks: { young: ['PK-Y1', 'GR-Y3', 'OR-Y1', 'GD-Y1'] },
    });
    expect(s.stacks[0]).toEqual(['p3', 'p2', 'p1']);
    // 1. Priya (top of stack) takes Fall in love: moves to 4, Pink disc
    expect(cur(s)).toBe('p1');
    s = play(s, q('PK-Y5'));
    expect(P(s, 'p1').position).toBe(4);
    expect(P(s, 'p1').tower).toEqual(['PK-Y5']);
    // 2. Arun is now on top at 0: Keep a diary, moves to 2; the swap does nothing yet (R3)
    expect(s.stacks[0]).toEqual(['p3', 'p2']);
    expect(cur(s)).toBe('p2');
    s = play(s, q('GR-Y2'));
    expect(P(s, 'p2').position).toBe(2);
    expect(s.phase).toBe('playing');
    expect(
      s.log.some((e) => e.type === 'swap_skipped' && e.playerId === 'p2' && e.reason === 'nothing_to_swap'),
    ).toBe(true);
    // 3. Meera is furthest back at 0: See the sea, moves to 2 on top of Arun
    expect(cur(s)).toBe('p3');
    s = play(s, q('PU-Y1'));
    expect(s.stacks[2]).toEqual(['p2', 'p3']);
    // 4. Meera on top at space 2 goes before Arun; she Rushes, discarding First crush, to 5 (just ahead of Priya)
    expect(cur(s)).toBe('p3');
    expect(s.market.young).toContain('PK-Y1');
    s = play(s, rush('PK-Y1'));
    expect(s.discard).toEqual(['PK-Y1']);
    expect(s.market.young).not.toContain('PK-Y1');
    expect(P(s, 'p3').position).toBe(5);
    // 5. Arun (2) is furthest back: Learn an instrument → 5, on top of Meera
    expect(cur(s)).toBe('p2');
    s = play(s, q('GR-Y3'));
    expect(P(s, 'p2').position).toBe(5);
    expect(s.stacks[5]).toEqual(['p3', 'p2']);
    // 6. Priya (4) is furthest back
    expect(cur(s)).toBe('p1');
    expect(s.turn).toBe(5);
  });

  it('RB-16: "Later" — Priya pays 5 − 1 = 4 for Get very good at something and swaps at Milestone 20', () => {
    let s = scen(3, {
      market: { middle: ['GD-M2', 'PK-M2'] },
      players: {
        p1: { position: 18, tower: ['PK-Y5', 'GD-Y1', 'PK-Y2', 'GD-Y2'], milestonesUsed: [10] },
        p2: { position: 21 },
        p3: { position: 24 },
      },
      stacks: { 18: ['p1'], 21: ['p2'], 24: ['p3'] },
    });
    expect(costBreakdown(s, 'p1', 'GD-M2')).toMatchObject({ printed: 5, experience: 1, cost: 4 });
    s = play(s, q('GD-M2'));
    expect(P(s, 'p1').position).toBe(22);
    expect(s.phase).toBe('pending_choice');
    expect(s.pending!.queue).toEqual([{ kind: 'swap', source: 'milestone', space: 20 }]);
    s = play(s, { type: 'swap', index: 1 }); // bring the Pinks together
    expect(P(s, 'p1').tower).toEqual(['PK-Y5', 'PK-Y2', 'GD-Y1', 'GD-Y2', 'GD-M2']);
  });

  it("RB-16: Arun's Doorway — second of three keeps 8: discs 3–10, 1 set +6, Passion +3, Reflection +4", () => {
    const tower = [
      'GR-Y1',
      'PU-Y1',
      'GD-O3',
      'GD-Y3',
      'GD-Y4',
      'PK-Y3',
      'OR-Y3',
      'PU-Y3',
      'GR-Y3',
      'GD-M2',
      'OR-Y4',
    ];
    let s = scen(3, {
      players: {
        p1: { position: 40 },
        p2: { position: 38, tower, milestonesUsed: [10, 20, 30] },
        p3: { position: 39, milestonesUsed: [10, 20, 30] },
      },
      stacks: { 40: ['p1'], 38: ['p2'], 39: ['p3'] },
    });
    s.players[0].arrivalOrder = 1;
    s.players[0].doorwayAllowance = 9;
    s.players[0].keptRange = [0, -1];
    s.arrivals = ['p1'];
    s = skipSwaps(play(s, rush())); // Arun 38 → 40
    expect(P(s, 'p2').arrivalOrder).toBe(2);
    expect(P(s, 'p2').doorwayAllowance).toBe(8);
    const best = bestWindow(s, 'p2');
    expect([best.start, best.end]).toEqual([2, 9]); // discs 3–10
    const w = scoreWindow(s, 'p2', 2, 9);
    expect(w.fullLife).toBe(6);
    expect(w.passion).toBe(3);
    expect(w.passionRun).toBe(3);
    expect(w.reflection).toBe(4);
    expect(w.cards).toBe(4 + 2 + 2 + 2 + 2 + 2 + 2 + 3);
    s = play(s, { type: 'choose_window', start: 2, end: 9 }, 'p2');
    expect(score(s).find((x) => x.playerId === 'p2')).toMatchObject({
      total: 19 + 6 + 3 + 4,
      kept: 8,
      discsLost: 3,
    });
  });
});
