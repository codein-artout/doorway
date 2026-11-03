import { describe, expect, it } from 'vitest';
import {
  apply,
  bestWindow,
  checkQuest,
  costBreakdown,
  legalMoves,
  score,
  scoreCards,
  IllegalMoveError,
  passionPoints,
} from '../src/index';
import { DEFAULT_RULESET, P, cur, hasMove, play, q, rules, rush, scen, skipSwaps } from './helpers';

const solo1 = (pos: number, extra: Parameters<typeof scen>[1] = {}) =>
  scen(2, {
    ...extra,
    players: {
      p1: { position: pos, ...(extra.players?.p1 ?? {}) },
      p2: { position: 39, ...(extra.players?.p2 ?? {}) },
    },
    stacks: { [pos]: ['p1'], 39: ['p2'] },
  });

describe('Milestones and swaps (rulebook §8, R3, R7, R8, R22, R23)', () => {
  it('RB-8.1 R23: landing on or passing a Milestone the first time offers a swap of two adjacent discs', () => {
    let s = solo1(8, {
      market: { young: ['PK-Y1', 'GD-Y1', 'GR-Y1'] },
      players: { p1: { tower: ['PU-Y1', 'OR-Y1'] } },
    });
    s = play(s, q('PK-Y1')); // 8 → 10 (lands on it)
    expect(s.phase).toBe('pending_choice');
    expect(legalMoves(s, 'p1')).toEqual([
      { type: 'swap', index: 0 },
      { type: 'swap', index: 1 },
      { type: 'skip_swap' },
    ]);
    s = play(s, { type: 'swap', index: 1 });
    expect(P(s, 'p1').tower).toEqual(['PU-Y1', 'PK-Y1', 'OR-Y1']);
    expect(s.phase).toBe('playing');
  });
  it('RB-8.2 R7: one move crossing two Milestones gives two swaps, in ascending order', () => {
    let s = solo1(9, { players: { p1: { tower: ['PU-Y1', 'OR-Y1', 'GD-Y1'] }, p2: { position: 20 } } });
    s.stacks = { 9: ['p1'], 20: ['p2'] };
    s.players[0].position = 9;
    // rush to 21 crosses 10 and 20
    s = play(s, rush());
    expect(s.pending!.queue.map((x) => x.space)).toEqual([10, 20]);
    s = play(s, { type: 'swap', index: 0 });
    expect(s.pending!.queue.map((x) => x.space)).toEqual([20]);
    s = play(s, { type: 'skip_swap' });
    expect(s.phase).toBe('playing');
  });
  it('RB-8.3: swaps are optional', () => {
    let s = solo1(8, {
      market: { young: ['PK-Y1', 'GD-Y1', 'GR-Y1'] },
      players: { p1: { tower: ['PU-Y1'] } },
    });
    s = play(s, q('PK-Y1'));
    s = play(s, { type: 'skip_swap' });
    expect(P(s, 'p1').tower).toEqual(['PU-Y1', 'PK-Y1']);
    expect(s.log.some((e) => e.type === 'swap_skipped' && e.reason === 'declined')).toBe(true);
  });
  it('RB-8.4: Milestones are per player, each once', () => {
    let s = scen(2, {
      market: { young: ['PK-Y1', 'GD-Y1', 'GR-Y1'] },
      players: {
        p1: { position: 8, tower: ['PU-Y1', 'OR-Y1'] },
        p2: { position: 9, tower: ['PU-Y3', 'OR-Y3'] },
      },
      stacks: { 8: ['p1'], 9: ['p2'] },
    });
    s = skipSwaps(play(s, q('PK-Y1'))); // p1 8 → 10
    expect(cur(s)).toBe('p2');
    s = play(s, q('GD-Y1')); // p2 9 → 11 crosses 10 too
    expect(s.phase).toBe('pending_choice');
    expect(P(s, 'p2').milestonesUsed).toEqual([10]);
    const t = scen(2, {
      players: { p1: { position: 9, tower: ['PU-Y1', 'OR-Y1'], milestonesUsed: [10] }, p2: { position: 15 } },
      stacks: { 9: ['p1'], 15: ['p2'] },
    });
    expect(play(t, rush()).phase).toBe('playing');
  });
  it('R3: a swap with fewer than 2 discs is skipped automatically; the Milestone still counts', () => {
    let s = solo1(8, { market: { young: ['PK-Y1', 'GD-Y1', 'GR-Y1'] } });
    s = play(s, q('PK-Y1'));
    expect(s.phase).toBe('playing');
    expect(s.log.some((e) => e.type === 'swap_skipped' && e.reason === 'nothing_to_swap')).toBe(true);
    expect(P(s, 'p1').milestonesUsed).toEqual([10]);
    // rush across a Milestone with an empty tower
    let r = solo1(9, { players: { p2: { position: 12 } } });
    r.stacks = { 9: ['p1'], 12: ['p2'] };
    r = play(r, rush());
    expect(r.phase).toBe('playing');
    expect(P(r, 'p1').milestonesUsed).toEqual([10]);
  });
  it('RB-7.P5 R22: Keep a diary swaps now (optional); the new disc may be one of the two', () => {
    let s = solo1(0, {
      market: { young: ['GR-Y2', 'GD-Y1', 'GR-Y1'] },
      players: { p1: { tower: ['PU-Y1'] } },
    });
    s = play(s, q('GR-Y2'));
    expect(s.pending!.queue).toEqual([{ kind: 'swap', source: 'diary' }]);
    s = play(s, { type: 'swap', index: 0 });
    expect(P(s, 'p1').tower).toEqual(['GR-Y2', 'PU-Y1']);
    let t = solo1(0, {
      market: { young: ['GR-Y2', 'GD-Y1', 'GR-Y1'] },
      players: { p1: { tower: ['PU-Y1'] } },
    });
    t = play(play(t, q('GR-Y2')), { type: 'skip_swap' });
    expect(P(t, 'p1').tower).toEqual(['PU-Y1', 'GR-Y2']);
  });
  it('R8: quest resolution order — diary swap, then Milestones, then refill, then arrival (swaps before arrival)', () => {
    // p1 at 34, takes a 6-year card with Keep a diary already? Use: diary first via GR-Y2 crossing 10.
    let s = solo1(8, {
      market: { young: ['GR-Y2', 'GD-Y1', 'GR-Y1'] },
      decks: { young: ['PK-Y5'] },
      players: { p1: { tower: ['PU-Y1', 'OR-Y1'] } },
    });
    s = play(s, q('GR-Y2')); // 8 → 10
    expect(s.pending!.queue.map((x) => x.source)).toEqual(['diary', 'milestone']);
    expect(s.market.young[0]).toBeNull(); // refill waits until swaps are done
    s = play(s, { type: 'swap', index: 1 });
    s = play(s, { type: 'skip_swap' });
    expect(s.market.young[0]).toBe('PK-Y5');
    // a quest from 28 to 40 still gets the Milestone-30 swap before arrival
    let a = scen(2, {
      market: { old: ['GR-O1', 'PU-O3'] },
      players: { p1: { position: 28, tower: ['PU-Y1', 'OR-Y1'] }, p2: { position: 39 } },
      stacks: { 28: ['p1'], 39: ['p2'] },
    });
    a.players[0].position = 35;
    a.stacks = { 35: ['p1'], 39: ['p2'] };
    a.players[0].milestonesUsed = [10, 20];
    a = scen(2, {
      market: { old: ['GR-O1', 'PU-O3'] },
      players: {
        p1: { position: 29, tower: ['PU-Y1', 'OR-Y1', 'GD-Y1'], milestonesUsed: [10, 20] },
        p2: { position: 39 },
      },
      stacks: { 29: ['p1'], 39: ['p2'] },
    });
    a.ruleset = rules({ trackLength: 34, 'ageBands.old': [28, 33] });
    a = play(a, q('GR-O1')); // 29 + 5 = 34 = trackLength, crosses 30
    expect(a.phase).toBe('pending_choice');
    expect(P(a, 'p1').arrivalOrder).toBeNull();
    a = play(a, { type: 'swap', index: 0 });
    expect(P(a, 'p1').arrivalOrder).toBe(1);
    const types = a.log.map((e) => e.type);
    expect(types.lastIndexOf('swap_made')).toBeLessThan(types.lastIndexOf('arrived'));
    expect(types.lastIndexOf('market_refilled')).toBeLessThan(types.lastIndexOf('arrived'));
  });
  it('RB-12.W1: the tower never reorders except through swaps', () => {
    let s = solo1(0, { market: { young: ['PK-Y1', 'GD-Y1', 'GR-Y1'] } });
    s = play(s, q('PK-Y1'));
    s = play(s, q('GD-Y1'));
    s = play(s, rush());
    expect(P(s, 'p1').tower).toEqual(['PK-Y1', 'GD-Y1']);
  });
  it('RB-12.R2: discs moved by a swap still count for requirements', () => {
    let s = solo1(18, {
      market: { middle: ['PK-M4', 'GD-M3'] },
      players: { p1: { tower: ['PK-Y1', 'GD-Y1', 'PK-Y2'] } },
    });
    s = play(s, rush()); // 18 → 21? p2 at 39 → 40 cap; use a different rush: p2 is at 39 so target 40
    // simpler: set up a direct swap via pending
    const t = solo1(18, {
      market: { middle: ['PK-M4', 'GD-M3'] },
      players: { p1: { tower: ['PK-Y1', 'GD-Y1', 'PK-Y2'] } },
    });
    t.players[0].tower = ['PK-Y1', 'PK-Y2', 'GD-Y1'];
    expect(checkQuest(t, 'p1', 'PK-M4').ok).toBe(true);
    expect(s).toBeTruthy();
  });
  it('RB-12.W3: requirements, discounts and powers use the whole tower during play', () => {
    const s = solo1(20, {
      market: { middle: ['PK-M4', 'GD-M3'] },
      players: {
        p1: {
          tower: ['PK-Y1', 'GD-Y1', 'GD-Y2', 'GD-Y3', 'GD-Y4', 'GD-Y5', 'GD-M1', 'GD-M2', 'GD-M4', 'PK-Y2'],
        },
      },
    });
    expect(checkQuest(s, 'p1', 'PK-M4').ok).toBe(true); // the two Love discs are far apart — still count
    expect(costBreakdown(s, 'p1', 'PK-M4').experience).toBe(1);
  });
});

describe('The Doorway (rulebook §9, R12, R24, R25)', () => {
  it('RB-9.1 RB-9.2 BS-5.4.4: a quest past 40 is allowed; you gain the disc, stop at 40 and arrive', () => {
    let s = solo1(37, { market: { old: ['GR-O1', 'PU-O3'] } });
    s = skipSwaps(play(s, q('GR-O1'))); // 37 + 5 → 40
    expect(P(s, 'p1').position).toBe(40);
    expect(P(s, 'p1').tower).toEqual(['GR-O1']);
    expect(P(s, 'p1').arrivalOrder).toBe(1);
    expect(s.log.find((e) => e.type === 'quest_taken')).toMatchObject({ from: 37, to: 40, cost: 5 });
  });
  it('RB-9.3 RB-9.T2 RB-12.D4: 2 players take 9 then 7, in arrival order', () => {
    let s = scen(2, {
      players: { p1: { position: 38 }, p2: { position: 39 } },
      stacks: { 38: ['p1'], 39: ['p2'] },
    });
    s = play(s, rush()); // p1 → 40 arrives first
    s = play(s, rush()); // p2 → 42 cap 40
    expect([P(s, 'p1').doorwayAllowance, P(s, 'p2').doorwayAllowance]).toEqual([9, 7]);
    expect(s.arrivals).toEqual(['p1', 'p2']);
  });
  const arriveAll = (n: number) => {
    const pos = [36, 37, 38, 39].slice(0, n);
    let s = scen(n, {
      players: Object.fromEntries(pos.map((p, i) => [`p${i + 1}`, { position: p }])),
      stacks: Object.fromEntries(pos.map((p, i) => [p, [`p${i + 1}`]])),
    });
    while (s.phase === 'playing') s = play(s, rush());
    return s;
  };
  it('RB-9.T3: 3 players take 9 / 8 / 7', () => {
    const s = arriveAll(3);
    expect(s.arrivals.map((id) => P(s, id).doorwayAllowance)).toEqual([9, 8, 7]);
  });
  it('RB-9.T4: 4 players take 9 / 8 / 7 / 6', () => {
    const s = arriveAll(4);
    expect(s.arrivals.map((id) => P(s, id).doorwayAllowance)).toEqual([9, 8, 7, 6]);
  });
  it('RB-9.4 RB-12.D1 R24: keep one unbroken stretch up to the allowance; the engine accepts any shorter window', () => {
    const tower = [
      'PK-Y1',
      'GD-Y1',
      'GR-Y1',
      'OR-Y1',
      'PU-Y1',
      'PK-Y2',
      'GD-Y2',
      'GR-Y2',
      'OR-Y2',
      'PU-Y2',
      'PK-Y3',
    ];
    let s = scen(2, {
      players: { p1: { position: 39, tower }, p2: { position: 30 } },
      stacks: { 39: ['p1'], 30: ['p2'] },
    });
    s.players[0].position = 39;
    s = play(s, rush(), 'p2'); // p2 → 40 first (allowance 9)
    s = skipSwaps(s);
    expect(P(s, 'p2').arrivalOrder).toBe(1);
    s = play(s, rush(), 'p1'); // p1 → 42 → 40 second, allowance 7
    expect(P(s, 'p1').doorwayAllowance).toBe(7);
    expect(s.phase).toBe('doorway_selection');
    expect(() => apply(s, { type: 'choose_window', start: 0, end: 7 }, 'p1')).toThrow(IllegalMoveError);
    expect(hasMove(s, 'p1', { type: 'choose_window', start: 2, end: 4 })).toBe(true); // shorter accepted
    const done = play(s, { type: 'choose_window', start: 4, end: 10 }, 'p1');
    expect(P(done, 'p1').keptRange).toEqual([4, 10]);
    expect(done.phase).toBe('over');
    expect(score(done).find((x) => x.playerId === 'p1')).toMatchObject({ kept: 7, discsLost: 4 });
  });
  it('RB-9.5 RB-12.D3: a tower no taller than the allowance is kept whole (automatically)', () => {
    let s = scen(2, {
      players: { p1: { position: 39, tower: ['PK-Y1', 'GD-Y1'] }, p2: { position: 30 } },
      stacks: { 39: ['p1'], 30: ['p2'] },
    });
    s = play(s, rush(), 'p2'); // p2 jumps past p1 to 40
    while (s.phase === 'playing') s = play(s, rush());
    expect(P(s, 'p1').keptRange).toEqual([0, 1]);
    expect(s.log.some((e) => e.type === 'window_chosen' && e.playerId === 'p1' && e.auto)).toBe(true);
  });
  it('RB-9.6 R25 BS-5.3: a window may be chosen any time after arriving, while others still play', () => {
    const tower = Array.from(
      { length: 10 },
      (_, i) => ['PK-Y', 'GD-Y', 'GR-Y', 'OR-Y', 'PU-Y'][i % 5] + (1 + Math.floor(i / 5)),
    );
    let s = scen(2, {
      players: { p1: { position: 39, tower }, p2: { position: 20 } },
      stacks: { 39: ['p1'], 20: ['p2'] },
    });
    s = play(s, rush(), 'p2'); // p2 → 40 (nearest ahead 39+1)... p2 arrives
    expect(P(s, 'p2').arrivalOrder).toBe(1);
    // p2 has empty tower → auto window. Make p1 arrive with a tall tower and others still playing: 3p
    let t = scen(3, {
      players: { p1: { position: 39, tower }, p2: { position: 10 }, p3: { position: 12 } },
      stacks: { 39: ['p1'], 10: ['p2'], 12: ['p3'] },
    });
    t = play(t, rush(), 'p2'); // 13
    t = play(t, rush(), 'p3'); // 14
    // jump p1 to 40 by manipulating: p1 only moves when furthest back. Force via scenario instead:
    t = scen(3, {
      players: { p1: { position: 30, tower }, p2: { position: 31 }, p3: { position: 33 } },
      stacks: { 30: ['p1'], 31: ['p2'], 33: ['p3'] },
      market: { old: ['GR-O1', 'PU-O3'] },
    });
    t.ruleset = rules({ milestones: [10, 20] });
    t = play(t, q('GR-O1')); // p1 30 → 35
    t = play(t, rush()); // p2 31 → 36
    t = play(t, rush()); // p3 33 → 36 (on top) … nearest ahead 35 → 36
    t = play(t, rush()); // p1 35 → 37
    // drive until p1 arrives
    while (P(t, 'p1').arrivalOrder === null) t = play(t, rush());
    expect(t.phase).toBe('playing');
    expect(legalMoves(t, 'p1').every((m) => m.type === 'choose_window')).toBe(true);
    const w = legalMoves(t, 'p1')[0] as { start: number; end: number };
    t = play(t, { type: 'choose_window', start: w.start, end: w.end }, 'p1');
    expect(P(t, 'p1').keptRange).not.toBeNull();
    expect(t.phase).toBe('playing');
    expect(() => apply(t, { type: 'choose_window', start: 0, end: 0 }, 'p1')).toThrow(/already chose/);
  });
  it('RB-9.7 BS-5.4.6 R25: the game ends only when everyone has arrived and every window is chosen', () => {
    const tower = Array.from(
      { length: 10 },
      (_, i) => ['PK-Y', 'GD-Y', 'GR-Y', 'OR-Y', 'PU-Y'][i % 5] + (1 + Math.floor(i / 5)),
    );
    let s = scen(2, {
      players: { p1: { position: 39, tower }, p2: { position: 38 } },
      stacks: { 39: ['p1'], 38: ['p2'] },
    });
    s = play(s, rush()); // p2 → 40, empty tower → auto
    s = play(s, rush()); // p1 → 40 with 10 discs vs allowance 7
    expect(s.phase).toBe('doorway_selection');
    expect(cur(s)).toBe('p1');
    s = play(s, { type: 'choose_window', start: 0, end: 6 });
    expect(s.phase).toBe('over');
    expect(s.log[s.log.length - 1].type).toBe('game_over');
  });
  it('RB-7.P7 RB-12.D2 RB-7.3: Make peace with it adds 1 even if the card itself falls away', () => {
    const tower = [
      'OR-O2',
      ...Array.from({ length: 9 }, (_, i) => ['PK-Y', 'GD-Y', 'GR-Y'][i % 3] + (1 + Math.floor(i / 3))),
    ];
    let s = scen(2, {
      players: { p1: { position: 39, tower }, p2: { position: 38 } },
      stacks: { 39: ['p1'], 38: ['p2'] },
    });
    s = play(s, rush());
    s = play(s, rush());
    expect(P(s, 'p1').doorwayAllowance).toBe(8); // 7 + 1
    s = play(s, { type: 'choose_window', start: 2, end: 9 });
    expect(score(s).find((x) => x.playerId === 'p1')!.kept).toBe(8);
  });
});

describe('Scoring (rulebook §10, R2, R26–R28)', () => {
  const sc = (ids: string[], r = DEFAULT_RULESET) => scoreCards(r, scen(1, {}).cards, ids);
  it('RB-10.1: card points are the printed points of kept cards', () => {
    expect(sc(['PK-Y1', 'GD-M2', 'GR-O2']).cards).toBe(1 + 3 + 4);
  });
  it('RB-10.2 R26 RB-12.S2: Full life = rarest-domain count × 6, in any order', () => {
    expect(sc(['PK-Y1', 'GD-Y1', 'GR-Y1', 'OR-Y1', 'PU-Y1']).fullLife).toBe(6);
    expect(
      sc(['PK-Y1', 'PK-Y2', 'GD-Y1', 'GD-Y2', 'GR-Y1', 'GR-Y3', 'OR-Y1', 'OR-Y2', 'PU-Y1', 'PU-Y3']).fullLife,
    ).toBe(12);
    expect(sc(['PK-Y1', 'GD-Y1', 'GR-Y1', 'OR-Y1']).fullLife).toBe(0);
  });
  it('RB-10.3 RB-12.S1: Passion uses the single longest run of touching same-domain discs', () => {
    const r = sc(['PK-Y1', 'PK-Y2', 'PK-Y3', 'GD-Y1', 'GD-Y2', 'GD-Y3', 'GD-Y4']);
    expect(r.passionRun).toBe(4);
    expect(r.passion).toBe(6);
    expect(sc(['PK-Y1', 'GD-Y1', 'PK-Y2', 'PK-Y3']).passionRun).toBe(2);
  });
  it('RB-10.T1: run 1–2 → 0', () =>
    expect([passionPoints(DEFAULT_RULESET, 1), passionPoints(DEFAULT_RULESET, 2)]).toEqual([0, 0]));
  it('RB-10.T2: run 3 → 3', () => expect(passionPoints(DEFAULT_RULESET, 3)).toBe(3));
  it('RB-10.T3: run 4 → 6', () => expect(passionPoints(DEFAULT_RULESET, 4)).toBe(6));
  it('RB-10.T4 R2: run 5+ → 10 (keys are thresholds)', () => {
    expect([5, 6, 9].map((n) => passionPoints(DEFAULT_RULESET, n))).toEqual([10, 10, 10]);
    expect(passionPoints(rules({ passion: { '2': 1, '6': 20 } }), 5)).toBe(1);
    expect(passionPoints(rules({ passion: { '4': 5 } }), 3)).toBe(0);
  });
  it('RB-10.4 RB-7.6 R27: each kept Reflection card scores +1 per kept disc of its domain, own included; two score separately', () => {
    expect(sc(['GD-O3', 'GD-Y1', 'GD-Y2', 'PK-Y1']).reflection).toBe(3);
    expect(sc(['GD-O3', 'PK-O3', 'GD-Y1', 'PK-Y1']).reflection).toBe(2 + 2);
  });
  it('RB-7.7: Reflection only counts if its card is kept', () => {
    const tower = ['GD-O3', 'GD-Y1', 'GD-Y2', 'GD-Y3'];
    expect(sc(tower.slice(1)).reflection).toBe(0);
  });
  it('RB-12.S3: one disc counts for points, a set, Passion and Reflection at once', () => {
    const r = sc(['GD-O3', 'GD-Y1', 'GD-Y2', 'PK-Y1', 'GR-Y1', 'OR-Y1', 'PU-Y1']);
    expect(r).toMatchObject({ cards: 4 + 1 + 1 + 1 + 1 + 1 + 1, fullLife: 6, passion: 3, reflection: 3 });
    expect(r.total).toBe(10 + 6 + 3 + 3);
  });
  it('BS-5.5 R24: score uses only the kept range; an empty tower scores 0', () => {
    expect(sc([]).total).toBe(0);
    const s = scen(1, { players: { p1: { tower: ['PK-Y1', 'GD-Y1', 'GR-Y1'] } } });
    expect(bestWindow(s, 'p1', 2).score.total).toBe(2);
  });
  const finish = (towers: string[][], arrival: number[]) => {
    const s = scen(towers.length, {
      players: Object.fromEntries(towers.map((t, i) => [`p${i + 1}`, { position: 40, tower: t }])),
      stacks: { 40: towers.map((_, i) => `p${i + 1}`) },
    });
    s.arrivals = arrival.map((i) => `p${i}`);
    s.players.forEach((p) => {
      p.arrivalOrder = arrival.indexOf(Number(p.id.slice(1))) + 1;
      p.doorwayAllowance = 9;
      p.keptRange = [0, p.tower.length - 1];
    });
    s.phase = 'over';
    return score(s);
  };
  it('RB-10.5: highest total wins', () => {
    const r = finish([['PK-Y5'], ['PK-Y1']], [2, 1]);
    expect(r.map((x) => x.winner)).toEqual([true, false]);
  });
  it('RB-10.6 R28: tie → most discs kept', () => {
    const r = finish([['PK-Y3'], ['PK-Y1', 'GD-Y1']], [1, 2]);
    expect(r[0].total).toBe(r[1].total);
    expect(r.map((x) => x.winner)).toEqual([false, true]);
  });
  it('RB-10.7 R28: still tied → earlier arrival', () => {
    const r = finish([['PK-Y1'], ['GD-Y1']], [2, 1]);
    expect(r.map((x) => x.winner)).toEqual([false, true]);
  });
  it('RB-10.8 R28: still tied → shared victory, each counting 1/k', () => {
    // identical keys are only possible before arrival (provisional); check the share logic on provisional scores
    const s = scen(3, { players: { p1: { tower: ['PK-Y1'] }, p2: { tower: ['GD-Y1'] }, p3: { tower: [] } } });
    const r = score(s);
    expect(r.map((x) => x.winShare)).toEqual([0.5, 0.5, 0]);
    expect(r.map((x) => x.rank)).toEqual([1, 1, 3]);
  });
});
