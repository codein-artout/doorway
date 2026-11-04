import { describe, expect, it } from 'vitest';
import { applyInPlace, botSeed, currentPlayer, init, Rng } from '@doorway/engine';
import { getPolicy, makeBotView, STRATEGY_IDS } from '../src/index';
import { CARDS, DEFAULT_RULESET } from './helpers';

const cheap = (id: string) =>
  getPolicy(id, id === 'lookahead' ? { params: { determinizations: 2 } } : undefined);

/** Play a game; optionally call explain() before every choose(). Returns the move list. */
function play(ids: string[], seed: string, withExplain: boolean) {
  const s = init(
    DEFAULT_RULESET,
    CARDS,
    ids.map((x, i) => ({ id: `p${i + 1}`, name: x, isBot: true, botPolicy: x })),
    seed,
  );
  const pols = ids.map(cheap);
  const rngs = ids.map((x, i) => Rng.fromSeed(botSeed(seed, i + 1, x)));
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 2000) {
    const pid = currentPlayer(s)!;
    const i = s.players.findIndex((p) => p.id === pid);
    const view = makeBotView(s, pid);
    let e = null;
    if (withExplain) {
      const before = rngs[i].toString();
      e = pols[i].explain?.(view) ?? null;
      expect(rngs[i].toString()).toBe(before); // never consumes the bot's RNG
    }
    const m = pols[i].choose(view, rngs[i]);
    void e;
    applyInPlace(s, m, pid);
  }
  return s.moves;
}

describe('Bot explain() (BUILD_PROMPT-v2 §N3)', () => {
  it('is pure: calling it before every move changes neither the RNG nor what choose() returns', () => {
    for (const ids of [
      ['greedy', 'tempo', 'specialist', 'generalist'],
      ['late_bloomer', 'rusher', 'set_collector', 'passion_specialist'],
      ['early_leaver', 'random', 'lookahead'],
      ['tempo@eps0.25', 'specialist@eps0.08'],
    ])
      for (let g = 0; g < 3; g++) expect(play(ids, `x${g}`, true)).toEqual(play(ids, `x${g}`, false));
  });

  it('every strategy exposes explain(); random returns none; weighted bots return per-feature contributions that sum to the total', () => {
    for (const id of STRATEGY_IDS) expect(typeof cheap(id).explain).toBe('function');
    const s = init(DEFAULT_RULESET, CARDS, [{ name: 'a' }, { name: 'b' }], 'ex');
    const view = makeBotView(s, 'p1');
    expect(cheap('random').explain!(view)).toBeNull();
    for (const id of STRATEGY_IDS.filter((x) => !['random', 'greedy', 'lookahead'].includes(x))) {
      const e = cheap(id).explain!(view)!;
      expect(e.kind).toBe('features');
      expect(e.options).toBe(view.legal.length);
      expect(e.candidates.filter((c) => c.chosen)).toHaveLength(1);
      for (const c of e.candidates)
        expect(c.parts.reduce((a, p) => a + p.contribution, 0)).toBeCloseTo(c.total, 9);
      // best first among eligible candidates
      const el = e.candidates.filter((c) => c.eligible).map((c) => c.total);
      expect(el).toEqual(el.slice().sort((a, b) => b - a));
    }
    const la = cheap('lookahead').explain!(view)!;
    expect(la.kind).toBe('value');
    expect(la.candidates.length).toBeGreaterThan(1);
    expect(cheap('greedy').explain!(view)!.kind).toBe('ppy');
  });

  it('the chosen candidate is the move choose() actually played (weighted, greedy and lookahead)', () => {
    // explicit check with chosen passed in
    const s = init(DEFAULT_RULESET, CARDS, [{ name: 'a' }, { name: 'b' }, { name: 'c' }], 'ch');
    for (const id of ['specialist', 'tempo', 'greedy', 'lookahead']) {
      const pol = cheap(id);
      const view = makeBotView(s, 'p1');
      const m = pol.choose(view, Rng.fromSeed(botSeed('ch', 1, id)));
      const e = pol.explain!(view, m)!;
      const chosen = e.candidates.find((c) => c.chosen)!;
      expect(chosen.move).toEqual(m);
      // without `chosen`, the top eligible candidate is what choose() picks (no ties at the start of this game)
      if (id !== 'lookahead') expect(pol.explain!(view)!.candidates.find((c) => c.chosen)!.move).toEqual(m);
    }
  });
});
