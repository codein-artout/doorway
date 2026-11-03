import { expect } from 'vitest';
import fc from 'fast-check';
import {
  applyInPlace,
  checkInvariants,
  cloneState,
  currentPlayer,
  init,
  legalMoves,
  replay,
  Rng,
  score,
  stateHash,
  toReplay,
  AGES,
  type GameState,
  type Move,
  type Ruleset,
} from '../src/index';
import { CARDS, seats } from './helpers';

const key = (m: Move) => JSON.stringify(m);

function accepts(s: GameState, m: Move, pid: string): boolean {
  try {
    applyInPlace(cloneState(s), m, pid, undefined, false);
    return true;
  } catch {
    return false;
  }
}

/** Candidate moves outside and inside the legal set, to check legalMoves ⟺ apply. */
function universe(s: GameState, pid: string): Move[] {
  const out: Move[] = [];
  const p = s.players.find((x) => x.id === pid)!;
  const ids = Object.keys(s.cards);
  const market = AGES.flatMap((a) => s.market[a]).filter((x): x is string => !!x);
  for (const id of [...market, ids[0], ids[ids.length - 1]])
    for (const ar of [false, true])
      for (const ir of [false, true]) {
        const m: Move = { type: 'quest', cardId: id };
        if (ar) m.useAgeReach = true;
        if (ir) m.useIgnoreReq = true;
        out.push(m);
      }
  out.push({ type: 'rush' });
  for (const id of [...market, ids[3]]) out.push({ type: 'rush', discardCardId: id });
  for (let i = -1; i <= p.tower.length; i++) out.push({ type: 'swap', index: i });
  out.push({ type: 'skip_swap' });
  const h = p.tower.length;
  if (p.arrivalOrder !== null && p.keptRange === null) {
    for (let a = -1; a <= h; a++)
      for (let b = a - 1; b <= h; b++) out.push({ type: 'choose_window', start: a, end: b });
  } else
    out.push({ type: 'choose_window', start: 0, end: 0 }, { type: 'choose_window', start: 0, end: h - 1 });
  return out;
}

export type Variant = { name: string; ruleset: Ruleset; players: () => number };

function playRandom(seed: string, n: number, r: Ruleset, exhaustive: boolean, sampleRng: Rng): void {
  const s = init(r, CARDS, seats(n), seed);
  const rng = Rng.fromSeed('driver|' + seed);
  let steps = 0;
  while (s.phase !== 'over') {
    if (++steps > 4000) throw new Error(`game ${seed} did not end`);
    // a random actor: usually the current player, sometimes an arrived player choosing a window
    const arrivedChoosers = s.players
      .filter((p) => p.arrivalOrder !== null && p.keptRange === null)
      .map((p) => p.id);
    const cp = currentPlayer(s)!;
    const pid = arrivedChoosers.length && rng.next() < 0.3 ? rng.pick(arrivedChoosers) : cp;
    const legal = legalMoves(s, pid);
    if (legal.length === 0) throw new Error(`no legal move for ${pid} in ${seed}`);
    // legalMoves ⟺ apply
    const legalKeys = new Set(legal.map(key));
    const u = universe(s, pid);
    const cands = exhaustive ? u : [rng.pick(u), rng.pick(u), rng.pick(legal)];
    for (const m of cands) {
      const ok = accepts(s, m, pid);
      if (ok !== legalKeys.has(key(m)))
        throw new Error(
          `legalMoves/apply disagree on ${key(m)} (accepted=${ok}) in game ${seed} step ${steps}`,
        );
    }
    if (exhaustive)
      for (const m of legal) if (!accepts(s, m, pid)) throw new Error(`legal move rejected ${key(m)}`);
    applyInPlace(s, rng.pick(legal), pid);
    const errs = checkInvariants(s);
    if (errs.length) throw new Error(`invariant broken in ${seed} step ${steps}: ${errs.join('; ')}`);
    // the tower is the card row (one array, R23); checkInvariants verifies every id is a real card in one place
  }
  // deterministic replay
  const back = replay(toReplay(s), { ruleset: r, cards: CARDS }).state;
  if (sampleRng.next() < 0.1) expect(stateHash(back)).toBe(stateHash(s));
  else expect(JSON.stringify(back.players)).toBe(JSON.stringify(s.players));
  expect(score(back)).toEqual(score(s));
}

export const runs = (variant: Variant, numRuns: number, exhaustiveEvery: number) => {
  let i = 0;
  const sampleRng = Rng.fromSeed('sample|' + variant.name);
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 12 }),
      fc.integer({ min: 0, max: 1_000_000 }),
      (str, k) => {
        const n = variant.players();
        const seed = `${variant.name}|${str}|${k}`;
        playRandom(seed, n, variant.ruleset, i++ % exhaustiveEvery === 0, sampleRng);
      },
    ),
    { numRuns, seed: 20261103, endOnFailure: true },
  );
};
