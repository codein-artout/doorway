// Lookahead bot: determinized Monte Carlo (flat MC over candidate moves with common random numbers).
// For each determinization the unseen cards of each age are shuffled (R15: deck order is never read),
// every candidate is applied and the game is rolled out to the end with a fast greedy policy.
// The budget is counted in rollouts (deterministic), not milliseconds.

import {
  applyInPlace,
  bestWindow,
  cloneState,
  costBreakdown,
  currentPlayer,
  questMoves,
  scoreAll,
  type GameState,
  type Move,
  type PlayerId,
  Rng,
} from '@doorway/engine';
import { cardValueFor, chooseSwap } from './features';
import type { BotPolicy, ExplainedCandidate } from './types';
import { bestWindowMove } from './view';
import { finishExplanation, type StrategyConfig } from './policies';

/** Fast greedy used inside rollouts: best points/year quest, else rush; skip swaps; best window. */
function rolloutMove(s: GameState, pid: PlayerId): Move {
  const p = s.players.find((x) => x.id === pid)!;
  if (p.arrivalOrder !== null) {
    const b = bestWindow(s, pid);
    return { type: 'choose_window', start: b.start, end: b.end };
  }
  if (s.phase === 'pending_choice') return { type: 'skip_swap' };
  let best: Move | null = null;
  let bestV = -1;
  for (const m of questMoves(s, pid)) {
    if (m.type !== 'quest') continue;
    const v = s.cards[m.cardId].points / Math.max(1, costBreakdown(s, pid, m.cardId).cost);
    if (v > bestV) {
      bestV = v;
      best = m;
    }
  }
  return best ?? { type: 'rush' };
}

function rollout(s: GameState): void {
  let guard = 0;
  while (s.phase !== 'over') {
    if (++guard > 3000) throw new Error('rollout did not terminate');
    // arrived players pick their windows as soon as they can
    const pid = currentPlayer(s)!;
    applyInPlace(s, rolloutMove(s, pid), pid, undefined, false);
    for (const p of s.players)
      if (p.arrivalOrder !== null && p.keptRange === null && (s.phase as string) !== 'over') {
        const b = bestWindow(s, p.id);
        applyInPlace(s, { type: 'choose_window', start: b.start, end: b.end }, p.id, undefined, false);
      }
  }
}

function determinize(view: GameState, rng: Rng): GameState {
  const s = cloneState(view);
  s.decks = {
    young: rng.shuffle(view.decks.young.slice()),
    middle: rng.shuffle(view.decks.middle.slice()),
    old: rng.shuffle(view.decks.old.slice()),
  };
  return s;
}

/** Candidate moves: all quests and the plain rush, plus the most damaging Rush discards. */
function candidates(s: GameState, me: PlayerId, legal: Move[], max: number): Move[] {
  const quests = legal.filter((m) => m.type === 'quest');
  const scored = quests
    .map((m) => {
      const c = s.cards[(m as { cardId: string }).cardId];
      const cost = costBreakdown(s, me, c.id).cost;
      return { m, v: c.points / Math.max(1, cost) + 0.05 * c.points };
    })
    .sort((a, b) => b.v - a.v)
    .slice(0, Math.max(1, max - 2))
    .map((x) => x.m);
  const rushes = legal.filter((m) => m.type === 'rush');
  const out: Move[] = [...scored, { type: 'rush' }];
  // the best discard to deny the next player
  let next: PlayerId | null = null;
  let low = Infinity;
  for (const o of s.players)
    if (o.id !== me && o.arrivalOrder === null && o.position < low) {
      low = o.position;
      next = o.id;
    }
  let bestD: Move | null = null;
  let bestDv = 0.4;
  for (const m of rushes)
    if (m.type === 'rush' && m.discardCardId) {
      const v = cardValueFor(s, next, m.discardCardId);
      if (v > bestDv) {
        bestDv = v;
        bestD = m;
      }
    }
  if (bestD) out.push(bestD);
  return out;
}

/** Mean outcome per candidate over determinized rollouts (shared by choose and explain). */
function evaluate(
  s: GameState,
  me: PlayerId,
  cands: Move[],
  params: { determinizations: number; rolloutsPerMove: number },
  rng: Rng,
): number[] {
  const totals = new Array(cands.length).fill(0);
  for (let d = 0; d < params.determinizations; d++) {
    const det = determinize(s, rng);
    for (let r = 0; r < params.rolloutsPerMove; r++)
      for (let i = 0; i < cands.length; i++) {
        const g = cloneState(det);
        applyInPlace(g, cands[i], me, undefined, false);
        rollout(g);
        const sc = scoreAll(g);
        const mine = sc.find((x) => x.playerId === me)!;
        let bestOther = -Infinity;
        for (const x of sc) if (x.playerId !== me) bestOther = Math.max(bestOther, x.total);
        const margin = sc.length > 1 ? mine.total - bestOther : mine.total - 35;
        totals[i] += mine.winShare + 0.02 * margin;
      }
  }
  return totals;
}

export function makeLookahead(id: string, cfg: StrategyConfig): BotPolicy {
  const params = { determinizations: 6, rolloutsPerMove: 1, maxCandidates: 6, ...(cfg.params ?? {}) };
  return {
    id,
    label: cfg.label,
    params,
    choose(view, rng) {
      const s = view.state;
      const me = s.players.find((x) => x.id === view.me)!;
      if (me.arrivalOrder !== null) return bestWindowMove(s, view.me);
      if (s.phase === 'pending_choice') return chooseSwap(s, view.me);
      const cands = candidates(s, view.me, view.legal, params.maxCandidates);
      if (cands.length === 1) return cands[0];
      const totals = evaluate(s, view.me, cands, params, rng);
      let bi = 0;
      for (let i = 1; i < cands.length; i++) if (totals[i] > totals[bi] + 1e-9) bi = i;
      return cands[bi];
    },
    /** Values per candidate from a private RNG stream (seeded by the position), so `choose`'s stream is untouched. */
    explain(view, chosen) {
      const s = view.state;
      const me = s.players.find((x) => x.id === view.me)!;
      if (me.arrivalOrder !== null || s.phase === 'pending_choice') return null;
      const cands = candidates(s, view.me, view.legal, params.maxCandidates);
      const rng = Rng.fromSeed(`explain|${s.seed}|${view.me}|${s.moves.length}`);
      const totals =
        cands.length > 1
          ? evaluate(s, view.me, cands, params, rng)
          : [params.determinizations * params.rolloutsPerMove];
      const n = params.determinizations * params.rolloutsPerMove;
      const rows: ExplainedCandidate[] = cands.map((m, i) => {
        const v = totals[i] / n;
        return {
          move: m,
          total: v,
          parts: [{ feature: 'value', value: v, weight: 1, contribution: v }],
          eligible: true,
          chosen: false,
        };
      });
      return finishExplanation(
        {
          strategy: id,
          label: cfg.label,
          options: view.legal.length,
          kind: 'value',
          note: `${n} determinized rollouts per candidate; value = win share + 0.02 × score margin`,
        },
        rows,
        chosen,
      );
    },
  };
}
