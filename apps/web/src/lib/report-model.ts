// Analyst game report (DESIGN-v2 §4): KPIs, final table, turn economy, "played most like", turning points,
// and this game versus the bot study. Pure: reads the timeline of states, never changes a game.

import { getPolicy, makeBotView, STRATEGY_IDS } from '@doorway/bots';
import {
  bestWindow,
  botSeed,
  checkQuest,
  costBreakdown,
  currentPlayer,
  DOMAIN_NAMES,
  Rng,
  score,
  scoreCards,
  scoreIfWalkedNow,
  type GameState,
  type Move,
  type PlayerId,
} from '@doorway/engine';
import { roleOf, turnAt, type TurnPoint } from './analyst-model';
import { ordinal } from './format';

const P = (s: GameState, id: PlayerId) => s.players.find((p) => p.id === id)!;

export type FinalRow = {
  id: PlayerId;
  rank: number;
  name: string;
  role: string;
  arrived: string;
  tower: number;
  allowed: number;
  kept: number;
  lost: number;
  cards: number;
  fullLife: number;
  passion: number;
  reflection: number;
  total: number;
  win: string;
  winBest: boolean;
};

export function finalTable(s: GameState, viewer: PlayerId | null): FinalRow[] {
  const sc = score(s);
  return s.players
    .map((p, i) => {
      const b = sc[i];
      const allowed = p.doorwayAllowance ?? p.tower.length;
      const [a, z] = p.keptRange ?? [0, -1];
      const best = bestWindow(s, p.id, allowed);
      const chosen = scoreCards(s.ruleset, s.cards, p.tower.slice(a, z + 1)).total;
      const lbl = (x: number, y: number) => (y < x ? 'none' : `${x + 1}–${y + 1}`);
      const winBest = chosen >= best.score.total;
      const all = z - a + 1 === p.tower.length;
      return {
        id: p.id,
        rank: b.rank,
        name: p.name,
        role: roleOf(s, p.id, viewer),
        arrived: p.arrivalOrder ? ordinal(p.arrivalOrder) : '—',
        tower: p.tower.length,
        allowed,
        kept: b.kept,
        lost: b.discsLost,
        cards: b.cards,
        fullLife: b.fullLife,
        passion: b.passion,
        reflection: b.reflection,
        total: b.total,
        win: winBest
          ? `best (${all ? 'all kept' : lbl(a, z)})`
          : `${lbl(a, z)} · ${chosen - best.score.total} vs ${lbl(best.start, best.end)}`,
        winBest,
      };
    })
    .sort((x, y) => x.rank - y.rank || x.arrived.localeCompare(y.arrived));
}

export type EconomyRow = {
  id: PlayerId;
  name: string;
  turns: number;
  b2b: number;
  rushes: number;
  ypq: string;
  saved: number;
  swaps: string;
  think: string;
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

/** Swap moves (made or declined) per player across the timeline. */
function swapCounts(states: GameState[]) {
  const last = states[states.length - 1];
  const made: Record<string, number> = {};
  const offered: Record<string, number> = {};
  for (const pm of last.moves) {
    if (pm.move.type === 'swap' || pm.move.type === 'skip_swap') {
      offered[pm.playerId] = (offered[pm.playerId] ?? 0) + 1;
      if (pm.move.type === 'swap') made[pm.playerId] = (made[pm.playerId] ?? 0) + 1;
    }
  }
  return { made, offered };
}

export function economy(s: GameState, points: TurnPoint[], states: GameState[]): EconomyRow[] {
  const sw = swapCounts(states);
  return s.players.map((p) => {
    const mine = points.filter((x) => x.actor === p.id);
    let b2b = 0;
    for (let i = 2; i < points.length; i++)
      if (points[i].actor === p.id && points[i - 1].actor === p.id) b2b++;
    const quests = mine.filter((x) => x.move?.type === 'quest');
    const years = quests.reduce((a, x) => a + (x.to - x.from), 0);
    let saved = 0;
    for (const q of quests) {
      if (!q.before || q.move?.type !== 'quest') continue;
      const cb = costBreakdown(q.before, p.id, q.move.cardId);
      saved += cb.printed - cb.cost;
    }
    const th = median(mine.map((x) => x.thinkMs).filter((x): x is number => x !== null));
    return {
      id: p.id,
      name: p.name,
      turns: mine.length,
      b2b,
      rushes: mine.filter((x) => x.move?.type === 'rush').length,
      ypq: quests.length ? (years / quests.length).toFixed(1) : '—',
      saved,
      swaps: `${sw.made[p.id] ?? 0} / ${sw.offered[p.id] ?? 0}`,
      think:
        th === null ? '—' : p.isBot || th < 1000 ? `${Math.round(th)} ms` : `${(th / 1000).toFixed(1)} s`,
    };
  });
}

export type Kpi = { label: string; value: string; note: string };

export function kpis(s: GameState, points: TurnPoint[]): Kpi[] {
  const rows = finalTable(s, null);
  const top = rows[0];
  const second = rows.find((r) => r.total < top.total);
  const winners = rows.filter((r) => r.total === top.total && r.rank === top.rank);
  const turns = points.length - 1;
  const lost = rows.reduce((a, r) => a + r.lost, 0);
  const later = rows.filter((r) => r.arrived !== '1st');
  let b2b = 0;
  for (let i = 2; i < points.length; i++) if (points[i].actor === points[i - 1].actor) b2b++;
  const rushes = points.filter((x) => x.move?.type === 'rush').length;
  const thinkTotal = points.reduce((a, x) => a + (x.thinkMs ?? 0), 0);
  const pctOf = (n: number) => (turns ? `${Math.round((100 * n) / turns)}%` : '—');
  return [
    {
      label: 'Winner',
      value: `${winners.map((w) => w.name).join(' & ')} · ${top.total}`,
      note: second
        ? `by ${top.total - second.total} over ${second.name}`
        : s.players.length > 1
          ? 'tied'
          : 'solo',
    },
    {
      label: 'Length',
      value: `${turns} turns`,
      note: thinkTotal ? `${(thinkTotal / 60000).toFixed(1)} min of thinking` : 'think time not recorded',
    },
    {
      label: 'Discs lost',
      value: String(lost),
      note: later.length
        ? `non-first arrivals: ${(later.reduce((a, r) => a + r.lost, 0) / later.length).toFixed(1)} each`
        : 'solo',
    },
    { label: 'Back-to-back turns', value: String(b2b), note: `${pctOf(b2b)} of all turns` },
    { label: 'Rushes', value: String(rushes), note: `${pctOf(rushes)} of all turns` },
  ];
}

// ------------------------------------------------------------------ played most like

const sameMove = (a: Move, b: Move) => {
  if (a.type !== b.type) return false;
  if (a.type === 'quest' && b.type === 'quest') return a.cardId === b.cardId;
  if (a.type === 'rush' && b.type === 'rush') return (a.discardCardId ?? null) === (b.discardCardId ?? null);
  return false;
};

export type StyleRow = {
  id: PlayerId;
  name: string;
  decisions: number;
  bars: { id: string; label: string; v: number }[];
};

/**
 * Agreement = share of this player's quest/rush decisions where the strategy, given the same state, would have
 * chosen the same move. Every strategy except Random and Lookahead (too slow to rerun in the browser); each
 * strategy decides with the same seeded stream a bot in that seat would use, so the result is deterministic.
 */
export const STYLE_IDS = STRATEGY_IDS.filter((id) => id !== 'random' && id !== 'lookahead');

export function playedMostLike(s: GameState, points: TurnPoint[], top = 3): StyleRow[] {
  return s.players.map((p) => {
    const mine = points.filter((x) => x.actor === p.id && x.before && x.move);
    const bars = STYLE_IDS.map((id) => {
      const pol = getPolicy(id);
      let agree = 0;
      for (const d of mine) {
        const view = makeBotView(d.before!, p.id);
        const rng = Rng.fromSeed(`${botSeed(d.before!.seed, p.seat, id)}|m${d.before!.moves.length}`);
        if (sameMove(pol.choose(view, rng), d.move!)) agree++;
      }
      return { id, label: pol.label, v: mine.length ? agree / mine.length : 0 };
    })
      .sort((a, b) => b.v - a.v || a.label.localeCompare(b.label))
      .slice(0, top);
    return { id: p.id, name: p.name, decisions: mine.length, bars };
  });
}

// ------------------------------------------------------------------ turning points

export type TurningPoint = {
  t: string;
  text: string;
  effect: string;
  tone: 'good' | 'bad' | 'plain';
  move: number;
};

export function turningPoints(states: GameState[], points: TurnPoint[]): TurningPoint[] {
  const out: TurningPoint[] = [];
  const last = states[states.length - 1];
  for (let k = 1; k < points.length; k++) {
    const pt = points[k];
    const before = pt.before!;
    const who = P(before, pt.actor!);
    const turnLabel = `T${pt.turn}`;
    const moveNo = before.moves.length + 1;
    if (pt.move?.type === 'quest') {
      const after = states.find((x) => x.moves.length === before.moves.length + 1) ?? pt.state;
      const now = scoreIfWalkedNow(before, who.tower).total;
      const then = scoreIfWalkedNow(after, P(after, who.id).tower).total;
      const d = then - now;
      if (d >= 5 || d <= -5) {
        const c = before.cards[pt.move.cardId];
        out.push({
          t: turnLabel,
          text: `${who.name} took ${c.name} for ${pt.to - pt.from} year${pt.to - pt.from === 1 ? '' : 's'} (${pt.from}→${pt.to}).`,
          effect: `${d > 0 ? '+' : ''}${d} now`,
          tone: d > 0 ? 'good' : 'bad',
          move: moveNo,
        });
      }
    }
    if (pt.move?.type === 'rush' && pt.move.discardCardId) {
      const after = states.find((x) => x.moves.length === before.moves.length + 1) ?? pt.state;
      const next = currentPlayer(after);
      const card = before.cards[pt.move.discardCardId];
      if (next && next !== who.id && checkQuest(before, next, card.id).ok)
        out.push({
          t: turnLabel,
          text: `${who.name} rushed ${pt.from}→${pt.to} and discarded ${card.name} before ${P(before, next).name} could take it.`,
          effect: `denied ${card.points}+`,
          tone: 'plain',
          move: moveNo,
        });
    }
  }
  // swaps that create a run of 3+
  for (let i = 1; i < states.length; i++) {
    const s = states[i];
    const pm = s.moves[s.moves.length - 1];
    if (!pm || pm.move.type !== 'swap') continue;
    const prev = states[i - 1];
    const a = scoreCards(prev.ruleset, prev.cards, P(prev, pm.playerId).tower);
    const b = scoreCards(s.ruleset, s.cards, P(s, pm.playerId).tower);
    if (b.passionRun >= 3 && b.passionRun > a.passionRun) {
      const turn = turnAt(points, i);
      out.push({
        t: `T${turn}`,
        text: `${P(s, pm.playerId).name} swapped discs ${pm.move.index + 1} and ${pm.move.index + 2}: a run of ${b.passionRun}.`,
        effect: `+${b.passion - a.passion} passion`,
        tone: 'good',
        move: s.moves.length,
      });
    }
  }
  // arrivals: kept everything, or lost 3+
  for (let i = 1; i < states.length; i++) {
    const s = states[i];
    const pm = s.moves[s.moves.length - 1];
    if (!pm || pm.move.type !== 'choose_window') continue;
    const win = pm.move;
    const p = P(last, pm.playerId);
    const kept = win.end - win.start + 1;
    const lost = p.tower.length - kept;
    const turn = turnAt(points, i);
    if (p.tower.length > 0 && lost === 0)
      out.push({
        t: `T${turn}`,
        text: `${p.name} arrived ${ordinal(p.arrivalOrder ?? 1)} with ${p.tower.length} discs. The ${p.doorwayAllowance}-tile fit all of them.`,
        effect: '0 lost',
        tone: 'plain',
        move: s.moves.length,
      });
    else if (lost >= 3) {
      const gone = p.tower.filter((_, k) => k < win.start || k > win.end);
      const doms = [...new Set(gone.map((id) => DOMAIN_NAMES[s.cards[id].color]))];
      out.push({
        t: `T${turn}`,
        text: `${p.name} arrived ${ordinal(p.arrivalOrder ?? 1)}; the ${p.doorwayAllowance}-tile cut ${lost} memories (${doms.join(', ')}).`,
        effect: `−${lost} discs`,
        tone: 'bad',
        move: s.moves.length,
      });
    }
  }
  return out.sort((a, b) => a.move - b.move);
}

// ------------------------------------------------------------------ this game vs the bot study

export type StudyGroup = {
  games: number;
  turnsPerGame: number;
  lostFirst: number;
  lostLater: number;
  meanScore: number;
  backToBackShare: number;
  rushShare: number;
};
export type StudySummary = { generatedAt: string; groups: Record<string, StudyGroup> };

export type VsRow = { m: string; g: string; s: string };

export function vsStudy(s: GameState, points: TurnPoint[], study: StudySummary | null): VsRow[] {
  const rows = finalTable(s, null);
  const n = s.players.length;
  const g = study?.groups[`${n}p`] ?? null;
  const turns = points.length - 1;
  const first = rows.find((r) => r.arrived === '1st');
  const later = rows.filter((r) => r.arrived !== '1st');
  let b2b = 0;
  for (let i = 2; i < points.length; i++) if (points[i].actor === points[i - 1].actor) b2b++;
  const rushes = points.filter((x) => x.move?.type === 'rush').length;
  const f1 = (x: number) => x.toFixed(1);
  const pc = (x: number) => `${Math.round(100 * x)}%`;
  const dash = '—';
  return [
    { m: 'Turns per game', g: String(turns), s: g ? f1(g.turnsPerGame) : dash },
    { m: 'Discs lost, 1st arrival', g: first ? String(first.lost) : dash, s: g ? f1(g.lostFirst) : dash },
    {
      m: 'Discs lost, later arrivals',
      g: later.length ? f1(later.reduce((a, r) => a + r.lost, 0) / later.length) : dash,
      s: g ? f1(g.lostLater) : dash,
    },
    {
      m: 'Mean score per player',
      g: f1(rows.reduce((a, r) => a + r.total, 0) / Math.max(1, rows.length)),
      s: g ? f1(g.meanScore) : dash,
    },
    { m: 'Back-to-back turns', g: turns ? pc(b2b / turns) : dash, s: g ? pc(g.backToBackShare) : dash },
    { m: 'Turns that are a Rush', g: turns ? pc(rushes / turns) : dash, s: g ? pc(g.rushShare) : dash },
  ];
}

/** Trim reports/data/summary.json to the numbers the report compares against (main-Np groups). */
export function trimStudy(summary: unknown): StudySummary | null {
  const sm = summary as {
    generatedAt?: string;
    groups?: Record<string, Record<string, unknown>>;
  } | null;
  if (!sm?.groups) return null;
  const out: StudySummary = { generatedAt: sm.generatedAt ?? '', groups: {} };
  for (const n of [2, 3, 4]) {
    const g = sm.groups[`main-${n}p`] as
      | {
          games: number;
          turnsPerGame: { mean: number };
          byArrival: Record<string, { lost: number }>;
          nonFirstLost: number;
          score: { mean: number };
          extraTurnShare: number;
          rushes: { mean: number };
          turnsPerPlayer: { mean: number };
        }
      | undefined;
    if (!g) continue;
    out.groups[`${n}p`] = {
      games: g.games,
      turnsPerGame: g.turnsPerGame.mean,
      lostFirst: g.byArrival['1']?.lost ?? 0,
      lostLater: g.nonFirstLost,
      meanScore: g.score.mean,
      backToBackShare: g.extraTurnShare,
      rushShare: g.turnsPerPlayer.mean ? g.rushes.mean / g.turnsPerPlayer.mean : 0,
    };
  }
  return out;
}
