// Scoring (rulebook §10, build spec §5.5, R2, R24, R26–R28).

import { passionPoints } from './ruleset';
import type { Card, GameState, PlayerId, Ruleset, ScoreBreakdown } from './types';
import { DOMAINS } from './types';

export type WindowScore = {
  cards: number;
  fullLife: number;
  fullLifeSets: number;
  passion: number;
  passionRun: number;
  reflection: number;
  total: number;
  kept: number;
};

/** Score a list of kept card ids (already the window, bottom → top). */
export function scoreCards(
  ruleset: Ruleset,
  cards: Record<string, Card>,
  kept: readonly string[],
): WindowScore {
  let pts = 0;
  const counts: Record<string, number> = { pink: 0, gold: 0, green: 0, orange: 0, purple: 0 };
  let run = 0;
  let longest = 0;
  let prev: string | null = null;
  for (const id of kept) {
    const c = cards[id];
    pts += c.points;
    counts[c.color]++;
    run = c.color === prev ? run + 1 : 1;
    prev = c.color;
    if (run > longest) longest = run;
  }
  let sets = Infinity;
  for (const d of DOMAINS) sets = Math.min(sets, counts[d]);
  if (kept.length === 0) sets = 0;
  let reflection = 0;
  for (const id of kept) {
    const r = cards[id].reflection;
    if (r) reflection += ruleset.reflectionPerDisc * counts[r];
  }
  const fullLife = sets * ruleset.fullLifeBonus;
  const passion = passionPoints(ruleset, longest);
  return {
    cards: pts,
    fullLife,
    fullLifeSets: sets,
    passion,
    passionRun: longest,
    reflection,
    total: pts + fullLife + passion + reflection,
    kept: kept.length,
  };
}

export function scoreWindow(state: GameState, playerId: PlayerId, start: number, end: number): WindowScore {
  const p = state.players.find((x) => x.id === playerId)!;
  return scoreCards(state.ruleset, state.cards, p.tower.slice(start, end + 1));
}

/** Best maximal window for a tower under an allowance (R24): max total, ties → lowest start. */
export function bestWindowFor(
  ruleset: Ruleset,
  cards: Record<string, Card>,
  tower: readonly string[],
  allowance: number,
): { start: number; end: number; score: WindowScore } {
  const h = tower.length;
  const len = Math.min(allowance, h);
  if (len <= 0) return { start: 0, end: -1, score: scoreCards(ruleset, cards, []) };
  let best: { start: number; end: number; score: WindowScore } | null = null;
  for (let s = 0; s + len <= h; s++) {
    const sc = scoreCards(ruleset, cards, tower.slice(s, s + len));
    if (!best || sc.total > best.score.total) best = { start: s, end: s + len - 1, score: sc };
  }
  return best!;
}

export function bestWindow(state: GameState, playerId: PlayerId, allowance?: number) {
  const p = state.players.find((x) => x.id === playerId)!;
  return bestWindowFor(
    state.ruleset,
    state.cards,
    p.tower,
    allowance ?? p.doorwayAllowance ?? p.tower.length,
  );
}

/**
 * Scores for every player. A chosen window is final; otherwise the score is provisional:
 * arrived → best window under the allowance; not arrived → the whole tower ("if you walked").
 * Ranking: total, then most kept, then earlier arrival; identical keys share (R28).
 */
export function scoreAll(state: GameState): ScoreBreakdown[] {
  const rows: ScoreBreakdown[] = state.players.map((p) => {
    let range: [number, number];
    let provisional = false;
    if (p.keptRange) range = p.keptRange;
    else {
      provisional = true;
      if (p.arrivalOrder !== null) {
        const b = bestWindow(state, p.id);
        range = [b.start, b.end];
      } else range = [0, p.tower.length - 1];
    }
    const sc = scoreWindow(state, p.id, range[0], range[1]);
    return {
      playerId: p.id,
      ...sc,
      towerHeight: p.tower.length,
      discsLost: p.tower.length - sc.kept,
      arrivalOrder: p.arrivalOrder,
      keptRange: p.keptRange ? [p.keptRange[0], p.keptRange[1]] : null,
      provisional,
      rank: 0,
      winner: false,
      winShare: 0,
    };
  });
  const key = (r: ScoreBreakdown) => [r.total, r.kept, -(r.arrivalOrder ?? Infinity)];
  const cmp = (a: ScoreBreakdown, b: ScoreBreakdown) => {
    const ka = key(a),
      kb = key(b);
    for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i];
    return 0;
  };
  const sorted = rows.slice().sort(cmp);
  for (const r of rows) r.rank = 1 + sorted.filter((o) => cmp(o, r) < 0).length;
  const winners = rows.filter((r) => r.rank === 1);
  for (const r of winners) {
    r.winner = true;
    r.winShare = 1 / winners.length;
  }
  return rows;
}
