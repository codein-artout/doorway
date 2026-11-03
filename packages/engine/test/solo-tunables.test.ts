import { describe, expect, it } from 'vitest';
import { apply, init, legalMoves, score, IllegalMoveError } from '../src/index';
import { CARDS, P, game, play, q, rules, rush, scen, seats, skipSwaps } from './helpers';

describe('Solo challenge (rulebook §11, R29)', () => {
  it('R29 BS-5.6: exactly one seat is a solo game (no flag needed)', () => {
    const s = game(1);
    expect(s.players.length).toBe(1);
    expect(s.stacks[0]).toEqual(['p1']);
  });
  it('RB-11.1 RB-13.15: solo allowance is solo.doorway (8), plus bonuses', () => {
    let s = scen(1, { players: { p1: { position: 38 } } });
    s = skipSwaps(play(s, rush()));
    expect(P(s, 'p1').doorwayAllowance).toBe(8);
    let t = scen(1, { players: { p1: { position: 38, tower: ['OR-O2'] } } }, rules({ 'solo.doorway': 5 }));
    t = skipSwaps(play(t, rush()));
    expect(P(t, 'p1').doorwayAllowance).toBe(6);
  });
  it('RB-11.3 RB-13.16: solo rush moves solo.rush (4) plus rush bonuses — never a pawn ahead', () => {
    expect(P(play(scen(1, { players: { p1: { position: 0 } } }), rush()), 'p1').position).toBe(4);
    expect(
      P(play(scen(1, { players: { p1: { position: 0, tower: ['GR-M2'] } } }), rush()), 'p1').position,
    ).toBe(5);
    expect(
      P(play(scen(1, { players: { p1: { position: 0 } } }, rules({ 'solo.rush': 6 })), rush()), 'p1')
        .position,
    ).toBe(6);
  });
  it('RB-11.2 R29: at the end of every turn each row drifts: leftmost non-empty discarded, slide left, refill right', () => {
    let s = scen(1, {
      market: { young: ['PK-Y1', 'GD-Y1', 'GR-Y1'], middle: ['PK-M2', 'GD-M3'], old: [null, 'PU-O3'] },
      decks: { young: ['OR-Y1', 'OR-Y2'], middle: ['PU-M2'], old: [] },
      players: { p1: { position: 0 } },
    });
    s.decks.old = [];
    s = play(s, q('GD-Y1')); // take middle young card: slot 1 refilled with OR-Y1, then drift
    // after quest: young = [PK-Y1, OR-Y1, GR-Y1]; drift discards PK-Y1 → [OR-Y1, GR-Y1, OR-Y2]
    expect(s.market.young).toEqual(['OR-Y1', 'GR-Y1', 'OR-Y2']);
    expect(s.market.middle).toEqual(['GD-M3', 'PU-M2']);
    expect(s.market.old).toEqual([null, null]); // PU-O3 drifted away, deck empty
    expect(s.discard).toEqual(['PK-Y1', 'PK-M2', 'PU-O3']);
    // drift also follows a rush
    const t = play(s, rush());
    expect(t.discard.slice(-1)).toEqual(['GD-M3']);
  });
  it('R29: a solo game ends when the player arrives and chooses a window', () => {
    let s = init(rules(), CARDS, seats(1), 'solo-end');
    let guard = 0;
    while (s.phase !== 'over' && guard++ < 500) {
      const ms = legalMoves(s, 'p1');
      s = apply(
        s,
        ms.find((m) => m.type === 'quest') ?? ms.find((m) => m.type === 'choose_window') ?? ms[0],
        'p1',
      ).state;
    }
    expect(s.phase).toBe('over');
    expect(score(s)[0].winner).toBe(true);
  });
});

describe('Tunable values are honoured (rulebook §13)', () => {
  it('RB-13.1: trackLength', () => {
    const r = rules({ trackLength: 36, 'ageBands.old': [28, 35] });
    let s = scen(
      2,
      { players: { p1: { position: 33 }, p2: { position: 34 } }, stacks: { 33: ['p1'], 34: ['p2'] } },
      r,
    );
    s = skipSwaps(play(s, rush())); // → 35
    s = skipSwaps(play(s, rush())); // p2 34 → 36 arrives
    expect(P(s, 'p2').arrivalOrder).toBe(1);
    expect(P(s, 'p2').position).toBe(36);
  });
  it('RB-13.2: ageBands', () => {
    const r = rules({ 'ageBands.young': [0, 9], 'ageBands.middle': [10, 27] });
    const s = scen(
      2,
      {
        market: { middle: ['PK-M2', 'GD-M3'] },
        players: { p1: { position: 10 }, p2: { position: 20 } },
        stacks: { 10: ['p1'], 20: ['p2'] },
      },
      r,
    );
    expect(legalMoves(s, 'p1').some((m) => m.type === 'quest' && m.cardId === 'PK-M2')).toBe(true);
  });
  it('RB-13.3: milestones', () => {
    const r = rules({ milestones: [5] });
    let s = scen(
      2,
      {
        market: { young: ['PK-Y5', 'GD-Y1', 'GR-Y1'] },
        players: { p1: { position: 2, tower: ['GD-Y2', 'GD-Y3'] }, p2: { position: 20 } },
        stacks: { 2: ['p1'], 20: ['p2'] },
      },
      r,
    );
    s = play(s, q('PK-Y5'));
    expect(s.pending?.queue[0].space).toBe(5);
  });
  it('RB-13.4: market row sizes', () => {
    const s = game(2, 'm', rules({ 'market.young': 4, 'market.old': 1 }));
    expect([s.market.young.length, s.market.middle.length, s.market.old.length]).toEqual([4, 2, 1]);
  });
  it('RB-13.5: experienceStep', () => {
    const r = rules({ experienceStep: 3 });
    const s = scen(
      2,
      {
        market: { young: ['PK-Y5', 'GD-Y1', 'GR-Y1'] },
        players: { p1: { position: 0, tower: ['PK-Y1', 'PK-Y2'] }, p2: { position: 9 } },
        stacks: { 0: ['p1'], 9: ['p2'] },
      },
      r,
    );
    expect(P(play(s, q('PK-Y5')), 'p1').position).toBe(4);
  });
  it('RB-13.6 R42: minCost (0 allowed)', () => {
    const r = rules({ minCost: 0 });
    const s = scen(
      2,
      {
        market: { young: ['PK-Y1', 'GD-Y1', 'GR-Y1'] },
        players: { p1: { position: 3, pendingNextQuestDiscount: 2 }, p2: { position: 9 } },
        stacks: { 3: ['p1'], 9: ['p2'] },
      },
      r,
    );
    const s2 = play(s, q('PK-Y1'));
    expect(P(s2, 'p1').position).toBe(3);
    expect(s2.turn).toBe(1);
  });
  it('RB-13.7: rushNoPawnAhead', () => {
    const s = scen(
      2,
      { players: { p1: { position: 5 }, p2: { position: 5 } }, stacks: { 5: ['p2', 'p1'] } },
      rules({ rushNoPawnAhead: 5 }),
    );
    expect(P(play(s, rush()), 'p1').position).toBe(10);
  });
  it('RB-13.8: rushDiscard off removes the discard option', () => {
    const s = game(2, 'x', rules({ rushDiscard: false }));
    expect(legalMoves(s, 'p1').filter((m) => m.type === 'rush')).toEqual([{ type: 'rush' }]);
    expect(() => apply(s, rush(s.market.young[0]!))).toThrow(IllegalMoveError);
  });
  const arrive = (n: number, r = rules()) => {
    const pos = [36, 37, 38, 39].slice(0, n);
    let s = scen(
      n,
      {
        players: Object.fromEntries(pos.map((p, i) => [`p${i + 1}`, { position: p }])),
        stacks: Object.fromEntries(pos.map((p, i) => [p, [`p${i + 1}`]])),
      },
      r,
    );
    while (s.phase === 'playing') s = play(s, rush());
    return s.arrivals.map((id) => P(s, id).doorwayAllowance);
  };
  it('RB-13.9: doorway.4', () =>
    expect(arrive(4, rules({ 'doorway.4': [10, 7, 5, 3] }))).toEqual([10, 7, 5, 3]));
  it('RB-13.10: doorway.3', () => expect(arrive(3, rules({ 'doorway.3.0': 12 }))).toEqual([12, 8, 7]));
  it('RB-13.11: doorway.2', () => expect(arrive(2, rules({ 'doorway.2': '10/6' }))).toEqual([10, 6]));
  const scoreOf = (ids: string[], r = rules()) => {
    const s = scen(1, { players: { p1: { tower: ids } } }, r);
    return score(s)[0];
  };
  const set = ['PK-Y1', 'GD-Y1', 'GR-Y1', 'OR-Y1', 'PU-Y1'];
  it('RB-13.12: fullLifeBonus', () => expect(scoreOf(set, rules({ fullLifeBonus: 10 })).fullLife).toBe(10));
  it('RB-13.13: passion table (dotted override and list override)', () => {
    const run = ['PK-Y1', 'PK-Y2', 'PK-Y3'];
    expect(scoreOf(run, rules({ 'passion.3': 5 })).passion).toBe(5);
    expect(scoreOf(run, rules({ passion: '2,4,7' })).passion).toBe(2);
  });
  it('RB-13.14: reflectionPerDisc', () =>
    expect(scoreOf(['GD-O3', 'GD-Y1'], rules({ reflectionPerDisc: 2 })).reflection).toBe(4));
  it('RB-13.17: experienceCap', () => {
    const s = scen(
      2,
      {
        market: { old: ['PK-O3', 'GD-O3'] },
        players: {
          p1: { position: 30, tower: ['PK-Y1', 'PK-Y2', 'PK-Y3', 'PK-Y4', 'PK-Y5', 'OR-Y1'] },
          p2: { position: 35 },
        },
        stacks: { 30: ['p1'], 35: ['p2'] },
      },
      rules({ experienceCap: 1 }),
    );
    expect(P(skipSwaps(play(s, q('PK-O3'))), 'p1').position).toBe(35); // 6 − min(1, 5/2=2) = 5
  });
});
