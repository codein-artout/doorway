import { describe, expect, it } from 'vitest';
import { currentPlayer, legalMoves, turnOrder, init, type GameState } from '../src/index';
import { CARDS, DEFAULT_RULESET, P, cur, game, play, q, rush, scen, seats, skipSwaps } from './helpers';

describe('Setup (rulebook §3)', () => {
  const s = game(4, 'setup');
  it('RB-3.1: the track runs 0..trackLength and every pawn starts on 0', () => {
    expect(s.ruleset.trackLength).toBe(40);
    expect(s.players.every((p) => p.position === 0)).toBe(true);
  });
  it('RB-3.2: three age decks, each shuffled (seed-dependent order)', () => {
    const all = [...s.decks.young, ...s.market.young];
    expect(all.sort()).toEqual(
      CARDS.filter((c) => c.age === 'young')
        .map((c) => c.id)
        .sort(),
    );
    const s2 = game(4, 'setup-other-seed');
    expect(s2.decks.young.join()).not.toBe(s.decks.young.join());
    for (const age of ['young', 'middle', 'old'] as const)
      expect([...s.decks[age], ...s.market[age]].every((id) => s.cards[id!].age === age)).toBe(true);
  });
  it('RB-3.3: market deals 3 Young, 2 Middle, 2 Old face up', () => {
    expect(s.market.young.length).toBe(3);
    expect(s.market.middle.length).toBe(2);
    expect(s.market.old.length).toBe(2);
    expect([...s.market.young, ...s.market.middle, ...s.market.old].every((x) => x !== null)).toBe(true);
    expect(s.decks.young.length + s.decks.middle.length + s.decks.old.length).toBe(60 - 7);
  });
  it('RB-3.4: a disc is created from the supply when its card is taken', () => {
    const id = s.market.young[0]!;
    const s2 = play(s, q(id));
    expect(P(s2, 'p1').tower).toEqual([id]);
  });
  it('RB-3.5: each player has a pawn and an empty tower', () => {
    expect(s.players.map((p) => p.tower.length)).toEqual([0, 0, 0, 0]);
    expect(Object.values(s.stacks).flat().sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
  });
  it('RB-3.6: Doorway tiles are sorted for the player count, 1st on top', () => {
    expect(s.ruleset.doorway['4']).toEqual([9, 8, 7, 6]);
  });
  it('RB-3.7 R6: the start stack is seat N … seat 1 (bottom → top); seat 1 goes first', () => {
    expect(s.stacks[0]).toEqual(['p4', 'p3', 'p2', 'p1']);
    expect(currentPlayer(s)).toBe('p1');
    const s3 = game(3);
    expect(s3.stacks[0]).toEqual(['p3', 'p2', 'p1']);
  });
  it('RB-3.8: no one starts with discs or cards', () => {
    expect(s.players.every((p) => p.tower.length === 0 && p.arrivalOrder === null)).toBe(true);
  });
});

describe('Whose turn (rulebook §4, R5)', () => {
  it('RB-4.1 RB-12.T1 BS-5.4.1: the player furthest back (lowest space) moves next — no rounds', () => {
    const s = scen(3, {
      players: { p1: { position: 12 }, p2: { position: 5 }, p3: { position: 9 } },
      stacks: { 12: ['p1'], 5: ['p2'], 9: ['p3'] },
    });
    expect(cur(s)).toBe('p2');
    expect(turnOrder(s)).toEqual(['p2', 'p3', 'p1']);
  });
  it('RB-4.2 RB-12.T3: ties go to the top pawn of the shared space', () => {
    const s = scen(3, {
      players: { p1: { position: 6 }, p2: { position: 6 }, p3: { position: 6 } },
      stacks: { 6: ['p1', 'p3', 'p2'] },
    });
    expect(cur(s)).toBe('p2');
    expect(cur(game(3))).toBe('p1');
  });
  it('RB-4.3 BS-5.4.5: a pawn landing on an occupied space goes on top', () => {
    const s = scen(2, {
      market: { young: ['PK-Y1', 'PK-Y3', 'PK-Y5'] },
      players: { p1: { position: 0 }, p2: { position: 3 } },
      stacks: { 0: ['p1'], 3: ['p2'] },
    });
    const s2 = play(s, q('PK-Y3'));
    expect(s2.stacks[3]).toEqual(['p2', 'p1']);
    expect(cur(s2)).toBe('p1');
  });
  it('RB-4.4: you take several turns in a row while you stay furthest back', () => {
    const s = scen(2, {
      market: { young: ['PK-Y1', 'GD-Y1', 'PK-Y5'] },
      players: { p1: { position: 0 }, p2: { position: 10 } },
      stacks: { 0: ['p1'], 10: ['p2'] },
    });
    let s2 = play(s, q('PK-Y1'));
    expect(cur(s2)).toBe('p1');
    s2 = play(s2, q('GD-Y1'));
    expect(cur(s2)).toBe('p1');
    expect(s2.turn).toBe(2);
  });
  it('RB-4.5 R12: arrived players take no turns and are ignored for furthest back', () => {
    const s = scen(3, {
      players: { p1: { position: 38 }, p2: { position: 30 }, p3: { position: 35 } },
      stacks: { 38: ['p1'], 30: ['p2'], 35: ['p3'] },
    });
    // p2 rushes to 36, p3 rushes to 39, p2 rushes to 40 (39+1) → arrives
    let t = play(s, rush());
    expect(P(t, 'p2').position).toBe(36);
    t = play(t, rush()); // p3 at 35 → 37? nearest ahead is p2 at 36 → 37
    expect(P(t, 'p3').position).toBe(37);
    let g = scen(2, {
      players: { p1: { position: 37 }, p2: { position: 39 } },
      stacks: { 37: ['p1'], 39: ['p2'] },
    });
    g = skipSwaps(play(g, rush())); // p1: nearest ahead 39 → 40, arrives
    expect(P(g, 'p1').arrivalOrder).toBe(1);
    expect(cur(g)).toBe('p2');
    expect(legalMoves(g, 'p1').some((m) => m.type === 'quest' || m.type === 'rush')).toBe(false);
    // p2 rushes with nobody ahead (p1 arrived is ignored) → +3 → 40
    g = play(g, rush());
    expect(P(g, 'p2').arrivalOrder).toBe(2);
  });
  it('R5: each Quest or Rush increments turn; swaps and window choices do not', () => {
    let s = scen(2, {
      market: { young: ['GR-Y2', 'PK-Y1', 'PK-Y2'] },
      players: { p1: { position: 8, tower: ['GD-Y1', 'GD-Y2'] }, p2: { position: 20 } },
      stacks: { 8: ['p1'], 20: ['p2'] },
    });
    s = play(s, q('PK-Y1')); // 8 → 10, milestone swap pending
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('pending_choice');
    s = play(s, { type: 'swap', index: 0 });
    expect(s.turn).toBe(1);
  });
  it('RB-12.T2: stack order only changes when a pawn arrives on that space', () => {
    let s = scen(3, {
      market: { young: ['PK-Y1', 'PK-Y2', 'GD-Y1'] },
      players: { p1: { position: 4 }, p2: { position: 4 }, p3: { position: 2 } },
      stacks: { 4: ['p1', 'p2'], 2: ['p3'] },
    });
    s = play(s, q('PK-Y1')); // p3 2 → 4, on top
    expect(s.stacks[4]).toEqual(['p1', 'p2', 'p3']);
    s = play(s, q('PK-Y2')); // p3 moves on to 6; the 4-stack keeps its order
    expect(s.stacks[4]).toEqual(['p1', 'p2']);
    expect(cur(s)).toBe('p2');
  });
});

describe('init guards', () => {
  it('BS-5.2: PlayerState and GameState carry the spec fields', () => {
    const s: GameState = init(DEFAULT_RULESET, CARDS, seats(2), 'fields');
    for (const k of [
      'rulesetId',
      'seed',
      'rngState',
      'phase',
      'pending',
      'players',
      'stacks',
      'market',
      'decks',
      'discard',
      'arrivals',
      'turn',
      'log',
    ])
      expect(s).toHaveProperty(k);
    for (const k of [
      'id',
      'name',
      'isBot',
      'position',
      'tower',
      'milestonesUsed',
      'oncePowersUsed',
      'pendingNextQuestDiscount',
      'arrivalOrder',
      'doorwayAllowance',
      'keptRange',
    ])
      expect(s.players[0]).toHaveProperty(k);
    const c = CARDS.find((x) => x.id === 'OR-O2')!;
    expect(Object.keys(c).sort()).toEqual([
      'age',
      'color',
      'id',
      'name',
      'points',
      'power',
      'reflection',
      'requires',
      'years',
    ]);
    expect(() => init(DEFAULT_RULESET, CARDS, [], 'x')).toThrow(/1–4 players/);
    expect(() => init(DEFAULT_RULESET, CARDS, seats(4).concat(seats(1)), 'x')).toThrow();
  });
});
