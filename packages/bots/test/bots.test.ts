import { describe, expect, it } from 'vitest';
import { bestWindowFor, currentPlayer, init, legalMoves, Rng, botSeed } from '@doorway/engine';
import {
  getPolicy,
  makeBotView,
  noisy,
  playGame,
  policyIdFor,
  SKILL_EPS,
  STRATEGIES,
  STRATEGY_IDS,
  greedyPolicy,
} from '../src/index';
import { CARDS, DEFAULT_RULESET } from './helpers';

describe('Bot interface and registry', () => {
  it('all 11 strategies come from strategies.json and resolve through one interface', () => {
    expect(STRATEGY_IDS).toEqual([
      'random',
      'greedy',
      'specialist',
      'generalist',
      'early_leaver',
      'late_bloomer',
      'tempo',
      'rusher',
      'set_collector',
      'passion_specialist',
      'lookahead',
    ]);
    for (const id of STRATEGY_IDS) {
      const p = getPolicy(id);
      expect(p.id).toBe(id);
      expect(typeof p.label).toBe('string');
      expect(typeof p.choose).toBe('function');
      expect(STRATEGIES[id].label).toBe(p.label);
    }
    expect(() => getPolicy('nope')).toThrow(/Unknown bot strategy/);
  });
  it('noisy variants: <id>@eps<ε>, and UI skill levels map to ε 0.25 / 0.08 / 0', () => {
    const p = getPolicy('tempo@eps0.1');
    expect(p.id).toBe('tempo@eps0.1');
    expect(p.params.eps).toBe(0.1);
    expect(SKILL_EPS).toEqual({ casual: 0.25, normal: 0.08, sharp: 0 });
    expect(policyIdFor('tempo', 'casual')).toBe('tempo@eps0.25');
    expect(policyIdFor('tempo', 'sharp')).toBe('tempo');
    // ε = 1 is uniform random over legal moves
    const s = init(DEFAULT_RULESET, CARDS, [{ name: 'A' }, { name: 'B' }], 'eps');
    const view = makeBotView(s, 'p1');
    const n = noisy(greedyPolicy(), 1);
    const seen = new Set<string>();
    const rng = Rng.fromSeed('e');
    for (let i = 0; i < 300; i++) seen.add(JSON.stringify(n.choose(view, rng)));
    expect(seen.size).toBe(view.legal.length);
  });
});

describe('Hidden information (R15, RB-12.P1)', () => {
  it('R15 RB-12.P1: the BotView shows everything public but never the deck order', () => {
    const s = init(DEFAULT_RULESET, CARDS, [{ name: 'A' }, { name: 'B' }, { name: 'C' }], 'hidden');
    const t = JSON.parse(JSON.stringify(s));
    t.decks.young.reverse();
    t.decks.middle.reverse();
    const a = makeBotView(s, 'p1');
    const b = makeBotView(t, 'p1');
    expect(a.state.decks).toEqual(b.state.decks); // order is gone
    expect(a.state.decks.young).toEqual(s.decks.young.slice().sort());
    expect(a.deckCounts).toEqual({
      young: s.decks.young.length,
      middle: s.decks.middle.length,
      old: s.decks.old.length,
    });
    expect(a.state.rngState).toBe('hidden');
    // public things are all there: market, towers, positions, stacks, powers used
    expect(a.state.market).toEqual(s.market);
    expect(a.state.players).toEqual(s.players);
    expect(a.state.stacks).toEqual(s.stacks);
    // so every policy decides the same with either deck order
    for (const id of STRATEGY_IDS.filter((x) => x !== 'lookahead')) {
      const pa = getPolicy(id).choose(a, Rng.fromSeed('same'));
      const pb = getPolicy(id).choose(b, Rng.fromSeed('same'));
      expect(pa).toEqual(pb);
    }
  });
});

describe('Determinism (R30)', () => {
  it('R30: every strategy plays the same game for the same seed, on its own RNG stream', () => {
    for (const id of STRATEGY_IDS) {
      const seats = [{ policy: id }, { policy: 'greedy' }, { policy: id === 'random' ? 'tempo' : 'random' }];
      const pol = () =>
        seats.map((x) =>
          getPolicy(x.policy, x.policy === 'lookahead' ? { params: { determinizations: 2 } } : undefined),
        );
      const a = playGame({
        ruleset: DEFAULT_RULESET,
        cards: CARDS,
        seats,
        seed: 'det-' + id,
        policies: pol(),
      });
      const b = playGame({
        ruleset: DEFAULT_RULESET,
        cards: CARDS,
        seats,
        seed: 'det-' + id,
        policies: pol(),
      });
      expect(a.state.moves).toEqual(b.state.moves);
      expect(a.scores).toEqual(b.scores);
    }
    // changing a bot never changes the deal
    const x = playGame({
      ruleset: DEFAULT_RULESET,
      cards: CARDS,
      seats: [{ policy: 'greedy' }, { policy: 'tempo' }],
      seed: 'deal',
    });
    const y = playGame({
      ruleset: DEFAULT_RULESET,
      cards: CARDS,
      seats: [{ policy: 'random' }, { policy: 'tempo' }],
      seed: 'deal',
    });
    expect(init(DEFAULT_RULESET, CARDS, [{ name: 'a' }, { name: 'b' }], 'deal').decks).toEqual(
      init(DEFAULT_RULESET, CARDS, [{ name: 'c' }, { name: 'd' }], 'deal').decks,
    );
    expect(x.state.seed).toBe(y.state.seed);
    expect(botSeed('deal', 1, 'greedy')).not.toBe(botSeed('deal', 1, 'random'));
  });
});

describe('Windows (R24, R25)', () => {
  it('R24 R25: bots choose their window as soon as they arrive, and optimally (max score over maximal windows)', () => {
    for (let g = 0; g < 30; g++) {
      const r = playGame({
        ruleset: DEFAULT_RULESET,
        cards: CARDS,
        seats: [{ policy: 'tempo' }, { policy: 'random' }, { policy: 'greedy' }],
        seed: 'w' + g,
        events: true,
      });
      for (const p of r.state.players) {
        const arrivedAt = r.events!.findIndex((e) => e.type === 'arrived' && e.playerId === p.id);
        const chosenAt = r.events!.findIndex((e) => e.type === 'window_chosen' && e.playerId === p.id);
        expect(chosenAt).toBeGreaterThan(arrivedAt);
        // no event of another player's turn in between
        const between = r.events!.slice(arrivedAt + 1, chosenAt);
        expect(between.some((e) => e.type === 'quest_taken' || e.type === 'rushed')).toBe(false);
        const [a, b] = p.keptRange!;
        expect(b - a + 1).toBe(Math.min(p.tower.length, p.doorwayAllowance!));
        // optimal: no other window scores more
        const sc = r.scores.find((x) => x.playerId === p.id)!;
        const best = bestWindowFor(r.state.ruleset, r.state.cards, p.tower, p.doorwayAllowance!);
        expect(sc.total).toBe(best.score.total);
        expect(sc.provisional).toBe(false);
      }
    }
  });
});

describe('Legality', () => {
  it('views offer exactly the engine legal moves', () => {
    const s = init(DEFAULT_RULESET, CARDS, [{ name: 'A' }, { name: 'B' }], 'v');
    const pid = currentPlayer(s)!;
    expect(makeBotView(s, pid).legal).toEqual(legalMoves(s, pid));
  });
});
