// Analyst view model (DESIGN-v2 §4). Pure functions over engine states: the React components only render these.

import { getPolicy, makeBotView, type Explanation } from '@doorway/bots';
import {
  AGES,
  ageIndex,
  ageOf,
  checkQuest,
  costBreakdown,
  currentPlayer,
  DOMAIN_NAMES,
  DOMAINS,
  previewMove,
  scoreIfWalkedNow,
  turnOrder,
  type Domain,
  type GameState,
  type Move,
  type PlayerId,
} from '@doorway/engine';

/** Player line styles by seat order (DESIGN-v2 §4). */
export const PLAYER_LINES = [
  { c: '#23202A', w: 2.5, dash: 'none' },
  { c: '#4F7290', w: 2, dash: '6 4' },
  { c: '#9A7A4A', w: 2, dash: '2 3' },
  { c: '#6E5A86', w: 2, dash: '9 3 2 3' },
] as const;
export const lineFor = (s: GameState, pid: PlayerId) =>
  PLAYER_LINES[(s.players.findIndex((p) => p.id === pid) + PLAYER_LINES.length) % PLAYER_LINES.length];

export const DOMAIN_CODE: Record<Domain, string> = {
  pink: 'Lv',
  gold: 'Wk',
  green: 'Pl',
  orange: 'Fm',
  purple: 'Wd',
};

const nameOf = (s: GameState, id: PlayerId) => s.players.find((p) => p.id === id)!.name;
const P = (s: GameState, id: PlayerId) => s.players.find((p) => p.id === id)!;

/** "Priya 11 → Arun 12 → …" for the players still on the track. */
export function queueText(s: GameState, order: PlayerId[] = turnOrder(s)): string {
  return order.map((id) => `${nameOf(s, id)} ${P(s, id).position}`).join(' → ');
}

export type DecisionRow = {
  key: string; // card id or 'rush'
  move: Move | null;
  cardId: string | null;
  name: string;
  color: Domain | null;
  age: string;
  ageOk: boolean;
  req: string;
  reqOk: boolean | null;
  years: number | null;
  disc: number;
  discTitle: string;
  cost: number | null;
  pts: number;
  ppy: string;
  lands: number | null;
  next: string;
  delta: number | null;
  bots: string;
  legal: boolean;
  reason: string;
  needsPower: string | null;
};

/** Rank (1-based) of each quest card among the legal quests, by a policy's explanation. */
function ranks(e: Explanation | null): Map<string, number> {
  const out = new Map<string, number>();
  if (!e) return out;
  let r = 0;
  for (const c of e.candidates)
    if (c.move.type === 'quest' && !out.has(c.move.cardId)) out.set(c.move.cardId, ++r);
  return out;
}

function nextText(s: GameState, viewer: PlayerId, move: Move) {
  const pv = previewMove(s, move, viewer);
  const after = pv.nextPlayer;
  let who = '';
  if (after === null) who = pv.arrives ? 'you arrive' : 'nobody';
  else if (after === viewer) who = 'you again';
  else {
    const queueAfter = pv.queueAfter;
    who = `${nameOf(s, after)} ${queueAfter.includes(after) ? P(s, after).position : ''}`.trim();
  }
  return { pv, text: who + (pv.onTopOf ? ' · you stack on top' : '') };
}

/** One row per face-up card plus a Rush row (DESIGN-v2 §4 decision table). */
export function decisionRows(s: GameState, viewer: PlayerId, myTurn: boolean): DecisionRow[] {
  const me = P(s, viewer);
  const myAge = ageOf(s.ruleset, me.position);
  const view = myTurn ? makeBotView(s, viewer) : null;
  const g = ranks(view ? (getPolicy('greedy').explain?.(view) ?? null) : null);
  const t = ranks(view ? (getPolicy('tempo').explain?.(view) ?? null) : null);
  const rows: DecisionRow[] = [];
  for (const age of AGES)
    for (const id of s.market[age]) {
      if (!id) continue;
      const c = s.cards[id];
      const ageOk = myAge !== null && ageIndex(c.age) <= ageIndex(myAge);
      const chk = checkQuest(s, viewer, id);
      let have = 0;
      if (c.requires) for (const x of me.tower) if (s.cards[x].color === c.requires.color) have++;
      const reqOk = c.requires ? have >= c.requires.count : null;
      const cb = costBreakdown(s, viewer, id);
      const disc = cb.experience + cb.power + cb.nextQuest;
      const legal = myTurn && chk.ok;
      const move: Move | null = chk.ok
        ? {
            type: 'quest',
            cardId: id,
            ...(chk.useAgeReach ? { useAgeReach: true } : {}),
            ...(chk.useIgnoreReq ? { useIgnoreReq: true } : {}),
          }
        : null;
      const nx = legal && move ? nextText(s, viewer, move) : null;
      const needsPower = chk.ok
        ? chk.useAgeReach
          ? 'Old friends'
          : chk.useIgnoreReq
            ? 'Say yes more'
            : null
        : null;
      const delta = scoreIfWalkedNow(s, [...me.tower, id]).total - scoreIfWalkedNow(s, me.tower).total;
      const reason = chk.ok
        ? needsPower
          ? `uses ${needsPower} (once)`
          : ''
        : chk.reason === 'too_young'
          ? 'too young'
          : chk.reason === 'requirement'
            ? `needs ${c.requires!.count} ${DOMAIN_NAMES[c.requires!.color]}`
            : chk.message;
      rows.push({
        key: id,
        move,
        cardId: id,
        name: c.name,
        color: c.color,
        age: ageOk ? 'ok' : chk.ok && chk.useAgeReach ? 'reach' : `from ${s.ruleset.ageBands[c.age][0]}`,
        ageOk: ageOk || (chk.ok && chk.useAgeReach),
        req: c.requires ? `${reqOk ? '✓' : '✗'} ${c.requires.count} ${DOMAIN_NAMES[c.requires.color]}` : '—',
        reqOk,
        years: c.years,
        disc,
        discTitle: `experience −${cb.experience} · power −${cb.power} · next quest −${cb.nextQuest}${
          cb.printed - disc < s.ruleset.minCost ? ` · minimum cost ${s.ruleset.minCost}` : ''
        }`,
        cost: cb.cost,
        pts: c.points,
        ppy: (c.points / cb.cost).toFixed(2),
        lands: nx ? nx.pv.landing : null,
        next: nx ? nx.text : myTurn ? reason : '',
        delta: legal ? delta : null,
        bots: legal ? `G#${g.get(id) ?? '–'} T#${t.get(id) ?? '–'}` : '',
        legal,
        reason,
        needsPower,
      });
    }
  const rush: Move = { type: 'rush' };
  const nx = myTurn ? nextText(s, viewer, rush) : null;
  rows.push({
    key: 'rush',
    move: rush,
    cardId: null,
    name: 'Rush',
    color: null,
    age: 'ok',
    ageOk: true,
    req: '—',
    reqOk: null,
    years: null,
    disc: 0,
    discTitle: '',
    cost: nx ? nx.pv.landing - me.position : null,
    pts: 0,
    ppy: '0.00',
    lands: nx ? nx.pv.landing : null,
    next: nx ? nx.text : '',
    delta: nx ? 0 : null,
    bots: '',
    legal: myTurn,
    reason: '',
    needsPower: null,
  });
  return rows;
}

/** The mono preview line under the decision table. */
export function previewLine(s: GameState, viewer: PlayerId, myTurn: boolean, move: Move | null): string {
  const cp = currentPlayer(s);
  const me = P(s, viewer);
  if (s.phase === 'over') return 'Game over.';
  if (!myTurn)
    return cp ? `${nameOf(s, cp)} is furthest back (${P(s, cp).position}) and is choosing.` : 'Waiting.';
  if (!move) {
    const n = decisionRows(s, viewer, true).filter((r) => r.legal && r.cardId).length;
    const rush = previewMove(s, { type: 'rush' }, viewer).landing;
    return `Your move. ${n} card${n === 1 ? '' : 's'} open to you, or rush to ${rush}.`;
  }
  const { pv, text } = nextText(s, viewer, move);
  if (move.type === 'rush')
    return `rush ${me.position}→${pv.landing}${move.discardCardId ? ` · discard ${move.discardCardId}` : ''} · next: ${text}`;
  if (move.type !== 'quest') return '';
  const c = s.cards[move.cardId];
  const cb = costBreakdown(s, viewer, move.cardId);
  const parts: string[] = [];
  if (cb.experience) parts.push(`${DOMAIN_NAMES[c.color]} ${cb.experience}`);
  if (cb.power) parts.push(`power ${cb.power}`);
  if (cb.nextQuest) parts.push(`next-quest ${cb.nextQuest}`);
  const why = parts.length ? ` (${cb.printed} − ${parts.join(' − ')})` : '';
  const d = pv.scoreDeltaNow;
  return `${move.cardId} · cost ${cb.cost}${why} · ${me.position}→${pv.landing} · next: ${text} · Δ now ${d >= 0 ? '+' : ''}${d}`;
}

export type LedgerRow = {
  id: PlayerId;
  name: string;
  role: string;
  pos: number | string;
  counts: (number | '·')[];
  score: number;
  current: boolean;
};

export function roleOf(s: GameState, id: PlayerId, viewer: PlayerId | null): string {
  const p = P(s, id);
  if (p.isBot) {
    const label = getPolicy(p.botPolicy ?? 'greedy').label;
    return `bot · ${label}`;
  }
  if (viewer === null) return 'human';
  return id === viewer ? 'you' : 'friend';
}

export function ledger(s: GameState, viewer: PlayerId | null) {
  const cp = currentPlayer(s);
  const rows: LedgerRow[] = s.players.map((p) => ({
    id: p.id,
    name: p.name,
    role: roleOf(s, p.id, viewer),
    pos: p.arrivalOrder !== null ? `D${p.arrivalOrder}` : p.position,
    counts: DOMAINS.map((d) => p.tower.filter((x) => s.cards[x].color === d).length || '·'),
    score: scoreIfWalkedNow(s, p.tower).total,
    current: p.id === cp,
  }));
  const discLines = s.players.map((p) => {
    const parts: string[] = [];
    for (const d of DOMAINS) {
      const probe = Object.values(s.cards).find((c) => c.color === d);
      if (!probe) continue;
      const cb = costBreakdown(s, p.id, probe.id);
      const total = cb.experience + cb.power;
      if (total > 0) parts.push(`${DOMAIN_NAMES[d]} −${total}`);
    }
    if (p.pendingNextQuestDiscount) parts.push(`next quest −${p.pendingNextQuestDiscount}`);
    return `${p.name}: ${parts.length ? parts.join(', ') : 'no discounts'}`;
  });
  const live = s.players.filter((p) => p.arrivalOrder === null).map((p) => p.position);
  const spread = live.length ? Math.max(...live) - Math.min(...live) : 0;
  return { rows, discLines, spread };
}

// ------------------------------------------------------------------ timeline

export type TurnPoint = {
  /** index into the timeline's states of the state this point shows (after swaps resolve) */
  index: number;
  turn: number;
  actor: PlayerId | null;
  move: Move | null;
  from: number;
  to: number;
  thinkMs: number | null;
  state: GameState;
  /** the state the actor faced when choosing (null for the start) */
  before: GameState | null;
  /** index of the state right after the quest/rush (0 for the start) */
  at: number;
};

/** The turn number a timeline state index belongs to. */
export const turnAt = (points: TurnPoint[], i: number) => {
  let t = 0;
  for (const p of points) if (p.at <= i) t = p.turn;
  return t;
};

/** One point per quest/rush turn (plus the start), each holding the state after that turn's swaps. */
export function turnPoints(tl: { states: GameState[]; thinkMs: (number | null)[] }): TurnPoint[] {
  const { states, thinkMs } = tl;
  if (!states.length) return [];
  const out: TurnPoint[] = [
    {
      index: 0,
      turn: 0,
      actor: null,
      move: null,
      from: 0,
      to: 0,
      thinkMs: null,
      state: states[0],
      before: null,
      at: 0,
    },
  ];
  for (let i = 1; i < states.length; i++) {
    const prev = states[i - 1];
    const s = states[i];
    const pm = s.moves[s.moves.length - 1];
    if (pm && (pm.move.type === 'quest' || pm.move.type === 'rush') && s.moves.length > prev.moves.length) {
      out.push({
        index: i,
        turn: out.length,
        actor: pm.playerId,
        move: pm.move,
        from: P(prev, pm.playerId).position,
        to: P(s, pm.playerId).position,
        thinkMs: thinkMs[i] ?? null,
        state: s,
        before: prev,
        at: i,
      });
    } else {
      const last = out[out.length - 1];
      last.index = i;
      last.state = s;
    }
  }
  return out;
}

export const thinkText = (ms: number | null, bot: boolean) =>
  ms === null ? '—' : bot || ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;

export type LogRow = { t: number; who: string; move: string; path: string; think: string; newest: boolean };

/** The last `n` quest/rush events, newest first. */
export function logRows(s: GameState, points: TurnPoint[], n = 8): LogRow[] {
  const ev = points.slice(1);
  return ev
    .slice(-n)
    .map((p, i, arr) => ({
      t: p.turn,
      who: nameOf(s, p.actor!),
      move:
        p.move!.type === 'quest'
          ? s.cards[p.move!.cardId].name
          : `rush${p.move!.type === 'rush' && p.move!.discardCardId ? ` · discard ${p.move!.discardCardId}` : ''}`,
      path: `${p.from}→${p.to}`,
      think: thinkText(p.thinkMs, P(s, p.actor!).isBot),
      newest: i === arr.length - 1,
    }))
    .reverse();
}

/** Pace, projection and expected Doorway loss for one player (DESIGN-v2 §4 "Your tower"). */
export function projection(s: GameState, pid: PlayerId, points: TurnPoint[]) {
  let years = 0;
  let quests = 0;
  for (const p of points)
    if (p.actor === pid && p.move?.type === 'quest') {
      years += p.to - p.from;
      quests++;
    }
  const pace = quests ? years / quests : 3;
  const me = P(s, pid);
  const projected = me.tower.length + Math.round((s.ruleset.trackLength - me.position) / Math.max(pace, 0.5));
  const tiles = s.ruleset.doorway[String(s.players.length)] ?? [9, 6];
  const hi = Math.max(...tiles);
  const lo = Math.min(...tiles);
  return {
    pace,
    projected,
    tiles: `${hi}–${lo}`,
    loseLo: Math.max(0, projected - hi),
    loseHi: Math.max(0, projected - lo),
  };
}

// ------------------------------------------------------------------ charts

export type ChartLine = {
  id: PlayerId;
  name: string;
  d: string;
  c: string;
  w: number;
  dash: string;
  last: number;
};
export const CHART = { x0: 40, x1: 630, y0: 180, y1: 20 };

function xOf(t: number, span: number) {
  return CHART.x0 + ((CHART.x1 - CHART.x0) * t) / Math.max(span, 1);
}

/** Position by turn: a step chart; y spans 0–20 and grows in steps of 10 as pawns pass it. */
export function positionChart(s: GameState, points: TurnPoint[]) {
  const span = Math.max(points.length - 1, 24);
  let max = 0;
  for (const p of points) for (const pl of p.state.players) max = Math.max(max, pl.position);
  const yMax = Math.max(20, Math.ceil(max / 10) * 10);
  const y = (v: number) => CHART.y0 - ((CHART.y0 - CHART.y1) * v) / yMax;
  const lines: ChartLine[] = s.players.map((pl) => {
    let d = `M${xOf(0, span)} ${y(0)}`;
    let last = 0;
    points.forEach((p, t) => {
      if (t === 0) return;
      const pos = p.state.players.find((x) => x.id === pl.id)!.position;
      if (pos !== last) {
        d += ` H${xOf(t, span).toFixed(1)} V${y(pos).toFixed(1)}`;
        last = pos;
      }
    });
    d += ` H${xOf(points.length - 1, span).toFixed(1)}`;
    const st = lineFor(s, pl.id);
    return { id: pl.id, name: pl.name, d, c: st.c, w: st.w, dash: st.dash, last };
  });
  return { lines, yMax, end: points.length - 1, span };
}

/** Score if each player walked through now, by turn; y auto-scales to a multiple of 4. */
export function scoreChart(s: GameState, points: TurnPoint[]) {
  const span = Math.max(points.length - 1, 24);
  const series = s.players.map((pl) =>
    points.map((p) => scoreIfWalkedNow(p.state, p.state.players.find((x) => x.id === pl.id)!.tower).total),
  );
  const max = Math.max(1, ...series.flat());
  const yMax = Math.max(12, Math.ceil(max / 4) * 4);
  const y = (v: number) => CHART.y0 - ((CHART.y0 - CHART.y1) * v) / yMax;
  const lines: ChartLine[] = s.players.map((pl, i) => {
    const d = series[i]
      .map((v, t) => `${t ? 'L' : 'M'}${xOf(t, span).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(' ');
    const st = lineFor(s, pl.id);
    return {
      id: pl.id,
      name: pl.name,
      d,
      c: st.c,
      w: st.w,
      dash: st.dash,
      last: series[i][series[i].length - 1],
    };
  });
  return { lines, yMax, end: points.length - 1, span };
}

// ------------------------------------------------------------------ why the bot did that

export const FEATURE_GROUPS: { key: string; label: string; color: string; features: string[] }[] = [
  { key: 'ppy', label: 'pts per year', color: '#23202A', features: ['ppy', 'points', 'value'] },
  { key: 'focus', label: 'focus domain', color: '#4F7290', features: ['targetDomain', 'missingDomain'] },
  { key: 'exp', label: 'experience', color: '#9A7A4A', features: ['expGain'] },
  { key: 'tempo', label: 'tempo', color: '#B9AE9A', features: ['cost', 'extraTurn', 'projDelta', 'late'] },
  {
    key: 'other',
    label: 'scoring & other',
    color: '#C98A6B',
    features: [],
  },
];
export const groupOf = (feature: string) =>
  FEATURE_GROUPS.find((g) => g.features.includes(feature)) ?? FEATURE_GROUPS[FEATURE_GROUPS.length - 1];

export function moveName(s: GameState, m: Move): string {
  if (m.type === 'quest') return s.cards[m.cardId].name;
  if (m.type === 'rush') return `Rush${m.discardCardId ? ` · discard ${m.discardCardId}` : ''}`;
  return m.type;
}

export type WhyBar = {
  name: string;
  tag: string;
  total: string;
  chosen: boolean;
  /** segments: positive contributions left to right, then negative ones (hatched) */
  parts: { feature: string; label: string; color: string; value: number; w: number; negative: boolean }[];
};

export type Why = {
  bot: string;
  header: string;
  kind: Explanation['kind'];
  bars: WhyBar[];
  groups: typeof FEATURE_GROUPS;
};

/** The last bot quest/rush decision, explained by the bot's own policy (bots `explain()`). */
export function lastBotWhy(points: TurnPoint[]): Why | null {
  for (let k = points.length - 1; k >= 1; k--) {
    const p = points[k];
    const before = p.before;
    if (!before || !p.actor) continue;
    const pl = P(before, p.actor);
    if (!pl.isBot) continue;
    const policy = getPolicy(pl.botPolicy ?? 'greedy');
    const e = policy.explain?.(makeBotView(before, p.actor), p.move!) ?? null;
    if (!e) return null;
    const top = e.candidates.slice(0, 4);
    if (!top.some((c) => c.chosen)) {
      const ch = e.candidates.find((c) => c.chosen);
      if (ch) top[top.length - 1] = ch;
    }
    const scale = Math.max(
      1e-9,
      ...top.map((c) => c.parts.reduce((a, x) => a + Math.abs(x.contribution), 0)),
    );
    const bars: WhyBar[] = top.map((c) => {
      const nz = c.parts.filter((x) => Math.abs(x.contribution) > 1e-9);
      const pos = nz.filter((x) => x.contribution > 0);
      const neg = nz.filter((x) => x.contribution < 0);
      const seg = (x: (typeof nz)[number]) => {
        const g = groupOf(x.feature);
        return {
          feature: x.feature,
          label: g.label,
          color: g.color,
          value: x.contribution,
          w: (100 * Math.abs(x.contribution)) / scale,
          negative: x.contribution < 0,
        };
      };
      let tag = c.chosen ? 'chosen' : c.eligible ? '' : 'not eligible';
      if (!c.chosen && c.move.type === 'quest') {
        const g = groupOf([...c.parts].sort((a, b) => b.contribution - a.contribution)[0]?.feature ?? '');
        if (g.key === 'focus') tag = `${DOMAIN_NAMES[before.cards[c.move.cardId].color]} focus`;
      }
      return {
        name:
          c.move.type === 'rush'
            ? `Rush to ${safeLanding(before, c.move, p.actor!)}`
            : moveName(before, c.move),
        tag,
        total: c.total.toFixed(2),
        chosen: c.chosen,
        parts: [...pos.map(seg), ...neg.map(seg)],
      };
    });
    const ms = p.thinkMs === null ? '—' : `${Math.round(p.thinkMs)} ms`;
    return {
      bot: pl.name,
      header: `turn ${p.turn} · ${e.label.toLowerCase()} · ${e.options} options · ${ms}`,
      kind: e.kind,
      bars,
      groups: FEATURE_GROUPS,
    };
  }
  return null;
}

function safeLanding(s: GameState, m: Move, pid: PlayerId) {
  try {
    return previewMove(s, m, pid).landing;
  } catch {
    return '?';
  }
}
