import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  apply,
  applyOverrides,
  botSeed,
  cardsHash,
  cost,
  currentPlayer,
  deserialize,
  init,
  isOver,
  legalMoves,
  replay,
  Rng,
  rulesetHash,
  score,
  serialize,
  stateHash,
  toReplay,
  IllegalMoveError,
  ReplayMismatchError,
  type GameState,
  type Move,
} from '../src/index';
import { CARDS, DEFAULT_RULESET, P, game, play, q, seats } from './helpers';

function randomGame(seed: string, n = 3, r = DEFAULT_RULESET): GameState {
  let s = init(r, CARDS, seats(n), seed);
  const rng = Rng.fromSeed('driver:' + seed);
  while (!isOver(s)) {
    const pid = currentPlayer(s)!;
    s = apply(s, rng.pick(legalMoves(s, pid)), pid).state;
  }
  return s;
}

describe('API (build spec §5.1)', () => {
  it('BS-5.1: init / currentPlayer / legalMoves / apply / isOver / score / cost', () => {
    const s = game(2);
    expect(currentPlayer(s)).toBe('p1');
    const ms = legalMoves(s, 'p1');
    expect(ms.length).toBeGreaterThan(0);
    expect(legalMoves(s, 'p2')).toEqual([]);
    const id = s.market.young[0]!;
    expect(cost(s, 'p1', id)).toBe(s.cards[id].years);
    const { state, events } = apply(s, q(id));
    expect(events[0].type).toBe('quest_taken');
    expect(state).not.toBe(s);
    expect(P(s, 'p1').tower).toEqual([]); // pure: the input is untouched
    expect(isOver(state)).toBe(false);
    expect(() => apply(s, { type: 'swap', index: 0 })).toThrow(IllegalMoveError);
    expect(() => apply(s, q('NOT-A-CARD'))).toThrow(IllegalMoveError);
    expect(score(state).map((x) => x.provisional)).toEqual([true, true]);
    const done = randomGame('api');
    expect(isOver(done)).toBe(true);
    expect(currentPlayer(done)).toBeNull();
    expect(legalMoves(done, 'p1')).toEqual([]);
  });
  it('BS-5.3: swaps are pending choices for the same player, resolved one at a time', () => {
    let s = game(2, 'pending');
    let found = false;
    const rng = Rng.fromSeed('x');
    while (!isOver(s)) {
      if (s.phase === 'pending_choice') {
        found = true;
        const pid = s.pending!.playerId;
        const ms = legalMoves(s, pid).filter((m) => m.type === 'swap' || m.type === 'skip_swap');
        expect(ms[ms.length - 1]).toEqual({ type: 'skip_swap' });
        expect(
          legalMoves(s, s.players.find((p) => p.id !== pid)!.id).some((m) => m.type !== 'choose_window'),
        ).toBe(false);
      }
      const pid = currentPlayer(s)!;
      s = apply(s, rng.pick(legalMoves(s, pid)), pid).state;
    }
    expect(found).toBe(true);
  });
  it('BS-5.7: the ruleset file has the spec §5.7 keys plus experienceCap and hints.bestWindow', () => {
    expect(Object.keys(DEFAULT_RULESET).sort()).toEqual(
      [
        'ageBands',
        'cardsFile',
        'doorway',
        'experienceCap',
        'experienceStep',
        'fullLifeBonus',
        'hints',
        'id',
        'market',
        'milestones',
        'minCost',
        'passion',
        'reflectionPerDisc',
        'rushDiscard',
        'rushNoPawnAhead',
        'solo',
        'trackLength',
      ].sort(),
    );
  });
  it('BS-EVENTS: the spec appendix events are emitted', () => {
    const types = new Set<string>();
    for (let i = 0; i < 20; i++) randomGame('ev' + i, 4).log.forEach((e) => types.add(e.type));
    for (const t of [
      'game_started',
      'quest_taken',
      'rushed',
      'market_refilled',
      'milestone_reached',
      'swap_made',
      'swap_skipped',
      'age_changed',
      'arrived',
      'window_chosen',
      'game_over',
    ])
      expect(types).toContain(t);
  });
  it('BS-5.4.4 R12: allowance = doorway[count][order − 1] + doorway bonuses', () => {
    const s = randomGame('allow', 4);
    for (const p of s.players) {
      const bonus = p.tower.filter((id) => s.cards[id].power?.type === 'doorway_bonus').length;
      expect(p.doorwayAllowance).toBe(DEFAULT_RULESET.doorway['4'][p.arrivalOrder! - 1] + bonus);
    }
  });
});

describe('Determinism, serialization and replays (R14, R30, R31)', () => {
  it('R14 R30: the same seed deals the same market; the RNG state serializes', () => {
    expect(game(4, 'same').market).toEqual(game(4, 'same').market);
    expect(game(4, 'same').decks).toEqual(game(4, 'same').decks);
    const r = Rng.fromSeed('abc');
    r.next();
    const copy = Rng.fromString(r.toString());
    expect([copy.next(), copy.next()]).toEqual([r.next(), r.next()]);
    expect(game(2, 'q').rngState).toMatch(/^[0-9a-f]{8}(:[0-9a-f]{8}){3}$/);
  });
  it('R30: bot streams are seeded from (game seed, seat, policy) and never touch the game stream', () => {
    expect(botSeed('g', 1, 'greedy')).not.toBe(botSeed('g', 2, 'greedy'));
    expect(botSeed('g', 1, 'greedy')).not.toBe(botSeed('g', 1, 'tempo'));
    const a = Rng.fromSeed(botSeed('g', 1, 'greedy')).next();
    expect(Rng.fromSeed(botSeed('g', 1, 'greedy')).next()).toBe(a);
  });
  it('R31: a replay reproduces identical events and scores', () => {
    const s = randomGame('replay-1', 4);
    const r = toReplay(s);
    const back = replay(r, { ruleset: DEFAULT_RULESET, cards: CARDS });
    expect(back.state.log).toEqual(s.log);
    expect(score(back.state)).toEqual(score(s));
    expect(stateHash(back.state)).toBe(stateHash(s));
    const withStates = replay(r, { ruleset: DEFAULT_RULESET, cards: CARDS }, { keepStates: true, upTo: 10 });
    expect(withStates.states!.length).toBe(11);
  });
  it('R31: a replay with a different ruleset or cards hash refuses to load and says why', () => {
    const s = randomGame('replay-2', 2);
    const r = toReplay(s);
    const other = applyOverrides(DEFAULT_RULESET, { fullLifeBonus: 8 });
    expect(() => replay(r, { ruleset: other, cards: CARDS })).toThrow(ReplayMismatchError);
    expect(() => replay(r, { ruleset: other, cards: CARDS })).toThrow(/different ruleset/);
    const cards2 = CARDS.map((c) => (c.id === 'PK-Y1' ? { ...c, points: 2 } : c));
    expect(() => replay(r, { ruleset: DEFAULT_RULESET, cards: cards2 })).toThrow(/different cards/);
    expect(rulesetHash(DEFAULT_RULESET)).toBe(s.rulesetHash);
    expect(cardsHash(CARDS)).toBe(s.cardsHash);
  });
  it('R31: serialize / deserialize round-trips; stateHash ignores the log only', () => {
    const s = randomGame('ser', 3);
    const t = deserialize(serialize(s));
    expect(t).toEqual(s);
    expect(stateHash(t)).toBe(stateHash(s));
    const u = play(game(2), { type: 'rush' } as Move);
    expect(stateHash(u)).not.toBe(stateHash(game(2)));
    expect(() => deserialize('{"x":1}')).toThrow(/Not a Doorway/);
  });
});

describe('Rule coverage checker', () => {
  it('BS-5.8.1: every rule ID in RULE_COVERAGE.md has a named test', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const r = spawnSync(process.execPath, [path.join(root, 'scripts/check-rule-coverage.mjs')], {
      encoding: 'utf8',
    });
    expect(r.stderr + r.stdout).toMatch(/rule coverage: all \d+ IDs have tests/);
    expect(r.status).toBe(0);
  });
});
