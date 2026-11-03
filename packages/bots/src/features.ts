// Shared move features for the weighted-scorer bots. Every feature reads only public information.

import {
  ageIndex,
  ageOf,
  baseAllowance,
  checkQuest,
  costBreakdown,
  experienceDiscount,
  passionPoints,
  scoreCards,
  turnPlayer,
  DOMAINS,
  type Card,
  type GameState,
  type Move,
  type PlayerId,
  type PlayerState,
  type Ruleset,
} from '@doorway/engine';

export const FEATURES = [
  'ppy', // points per year of this quest
  'points', // printed points
  'cost', // years spent (or moved, for a rush)
  'extraTurn', // after this move I am still furthest back (I move again)
  'expGain', // this disc raises my experience discount for its domain (× life left)
  'setDelta', // Full life progress in my projected window (× fullLifeBonus)
  'passionDelta', // Passion progress in my projected window, including swaps this move grants
  'reflectionDelta', // Reflection value change in my projected window (+ potential of a Reflection card)
  'projDelta', // change in the projected final window score
  'late', // points × fraction of life lived (save the best discs for the top)
  'ageUnlock', // this move takes me into an older age band
  'deny', // value of the taken / discarded card to the player who moves next
  'targetDomain', // card is in my 1–2 target domains (specialists)
  'missingDomain', // card's domain is absent from my projected window (generalists)
  'power', // value of the card's power (× life left)
  'oncePowerSpent', // number of once-per-game powers this quest spends
  'rush', // 1 for a rush (bias)
  'rushDeny', // value of the discarded card to the next player
  'rushSwap', // value of the Milestone swaps a rush grants
] as const;
export type Feature = (typeof FEATURES)[number];
export type FeatureVec = Partial<Record<Feature, number>>;

export const DEFAULT_POWER_VALUES: Record<string, number> = {
  discount: 1.2,
  rush_bonus: 0.6,
  age_reach_once: 0.5,
  ignore_requirement_once: 0.5,
  swap_now: 0.5,
  next_quest_discount: 0.8,
  doorway_bonus: 1.0,
};

export type EvalContext = {
  s: GameState;
  me: PlayerState;
  r: Ruleset;
  cards: Record<string, Card>;
  allowance: number;
  /** discs expected to be added after this move (used to project the final window) */
  avgYears: number;
  targets: string[];
  nextPlayer: PlayerId | null;
  baseWindow: WindowEval;
  powerValues: Record<string, number>;
};

export type WindowEval = {
  setFrac: number;
  passion: number;
  reflection: number;
  total: number;
  colors: Record<string, number>;
};

export function doorwayBonus(s: GameState, p: PlayerState): number {
  let b = 0;
  for (const id of p.tower) {
    const pw = s.cards[id].power;
    if (pw && pw.type === 'doorway_bonus') b += pw.amount;
  }
  return b;
}

/** Expected allowance if `p` keeps its current place in the race to the Doorway. */
export function projectedAllowance(s: GameState, p: PlayerState): number {
  if (p.doorwayAllowance !== null) return p.doorwayAllowance;
  const n = s.players.length;
  if (n === 1) return s.ruleset.solo.doorway + doorwayBonus(s, p);
  let ahead = 0;
  for (const o of s.players) if (o.id !== p.id && o.arrivalOrder === null && o.position > p.position) ahead++;
  const order = s.arrivals.length + ahead + 1;
  return baseAllowance(s.ruleset, n, order) + doorwayBonus(s, p);
}

/** The discs of `tower` likely to survive: the top (allowance − expected future discs). */
export function projectedSlice(
  tower: readonly string[],
  allowance: number,
  future: number,
): readonly string[] {
  const k = Math.max(1, Math.round(allowance - future));
  return tower.length <= k ? tower : tower.slice(tower.length - k);
}

export function evalWindow(r: Ruleset, cards: Record<string, Card>, w: readonly string[]): WindowEval {
  const colors: Record<string, number> = { pink: 0, gold: 0, green: 0, orange: 0, purple: 0 };
  let longest = 0,
    run = 0,
    prev = '';
  for (const id of w) {
    const c = cards[id].color;
    colors[c]++;
    run = c === prev ? run + 1 : 1;
    prev = c;
    if (run > longest) longest = run;
  }
  let sets = Infinity,
    above = 0;
  for (const d of DOMAINS) sets = Math.min(sets, colors[d]);
  for (const d of DOMAINS) if (colors[d] > sets) above++;
  let reflection = 0;
  for (const id of w) {
    const rf = cards[id].reflection;
    if (rf) reflection += r.reflectionPerDisc * colors[rf];
  }
  const sc = scoreCards(r, cards, w);
  return {
    setFrac: (sets + above / 5) * r.fullLifeBonus,
    // smooth Passion: table points + a little per disc of run, so 1→2 is worth something
    passion: passionPoints(r, longest) + 0.5 * longest,
    reflection,
    total: sc.total,
    colors,
  };
}

/** Best window value reachable with up to `swaps` adjacent swaps (greedy, one at a time). */
export function evalWithSwaps(
  r: Ruleset,
  cards: Record<string, Card>,
  tower: string[],
  allowance: number,
  future: number,
  swaps: number,
): { ev: WindowEval; tower: string[] } {
  let best = { ev: evalWindow(r, cards, projectedSlice(tower, allowance, future)), tower };
  for (let k = 0; k < swaps; k++) {
    let improved = false;
    const base = best.tower;
    for (let i = 0; i + 1 < base.length; i++) {
      const t = base.slice();
      const x = t[i];
      t[i] = t[i + 1];
      t[i + 1] = x;
      const ev = evalWindow(r, cards, projectedSlice(t, allowance, future));
      if (ev.total + ev.passion * 0.25 > best.ev.total + best.ev.passion * 0.25 + 1e-9) {
        best = { ev, tower: t };
        improved = true;
      }
    }
    if (!improved) break;
  }
  return best;
}

export function futureDiscs(r: Ruleset, position: number, avgYears: number): number {
  return Math.max(0, r.trackLength - position) / Math.max(1, avgYears);
}

export function makeContext(
  s: GameState,
  me: PlayerId,
  targets: string[],
  avgYears: number,
  powerValues: Record<string, number> = DEFAULT_POWER_VALUES,
): EvalContext {
  const p = s.players.find((x) => x.id === me)!;
  const allowance = projectedAllowance(s, p);
  const fut = futureDiscs(s.ruleset, p.position, avgYears);
  // who moves next if I stand still: the furthest-back other player
  let nextPlayer: PlayerId | null = null;
  let best = Infinity;
  for (const o of s.players)
    if (o.id !== me && o.arrivalOrder === null && o.position < best) {
      best = o.position;
      nextPlayer = o.id;
    }
  return {
    s,
    me: p,
    r: s.ruleset,
    cards: s.cards,
    allowance,
    avgYears,
    targets,
    nextPlayer,
    baseWindow: evalWindow(s.ruleset, s.cards, projectedSlice(p.tower, allowance, fut)),
    powerValues,
  };
}

/** Would `pid` still move next after landing on `to`? (furthest back; equal → on top, so yes) */
function staysBehind(s: GameState, me: PlayerState, to: number): boolean {
  if (to >= s.ruleset.trackLength) return false;
  for (const o of s.players) if (o.id !== me.id && o.arrivalOrder === null && o.position < to) return false;
  return true;
}

/** Value of a market card to another player (points per year if they could take it). */
export function cardValueFor(s: GameState, pid: PlayerId | null, cardId: string): number {
  if (!pid) return 0;
  const chk = checkQuest(s, pid, cardId);
  if (!chk.ok) return 0;
  const c = s.cards[cardId];
  return c.points / Math.max(1, costBreakdown(s, pid, cardId).cost);
}

export function swapsGranted(s: GameState, p: PlayerState, from: number, to: number, card?: Card): number {
  let n = card?.power?.type === 'swap_now' ? 1 : 0;
  for (const m of s.ruleset.milestones) if (from < m && m <= to && !p.milestonesUsed.includes(m)) n++;
  return n;
}

export function questFeatures(ctx: EvalContext, m: Extract<Move, { type: 'quest' }>): FeatureVec {
  const { s, me, r, cards } = ctx;
  const c = cards[m.cardId];
  const cost = costBreakdown(s, me.id, c.id).cost;
  const from = me.position;
  const to = Math.min(r.trackLength, from + cost);
  const L = r.trackLength;
  const fut = futureDiscs(r, to, ctx.avgYears);
  const tower2 = me.tower.concat(c.id);
  const swaps = swapsGranted(s, me, from, to, c);
  const after = evalWithSwaps(r, cards, tower2, ctx.allowance, fut, swaps).ev;
  let count = 0;
  for (const id of me.tower) if (cards[id].color === c.color) count++;
  const expGain =
    experienceDiscount(r, count + 1) > experienceDiscount(r, count) ? Math.max(0, (L - to) / L) : 0;
  const a0 = ageOf(r, from);
  const a1 = ageOf(r, to);
  const refPotential = c.reflection ? 0.5 * after.colors[c.reflection] : 0;
  const pv = c.power ? (ctx.powerValues[c.power.type] ?? 0) * Math.max(0, (L - to) / L) : 0;
  return {
    ppy: c.points / Math.max(1, cost),
    points: c.points,
    cost,
    extraTurn: staysBehind(s, me, to) ? 1 : 0,
    expGain,
    setDelta: after.setFrac - ctx.baseWindow.setFrac,
    passionDelta: after.passion - ctx.baseWindow.passion,
    reflectionDelta: after.reflection - ctx.baseWindow.reflection + refPotential,
    projDelta: after.total - ctx.baseWindow.total,
    late: c.points * (to / L),
    ageUnlock: a0 !== null && a1 !== null && ageIndex(a1) > ageIndex(a0) ? 1 : 0,
    deny: cardValueFor(s, ctx.nextPlayer, c.id),
    targetDomain: ctx.targets.includes(c.color) ? 1 : 0,
    missingDomain: ctx.baseWindow.colors[c.color] === 0 ? 1 : 0,
    power: pv,
    oncePowerSpent: (m.useAgeReach ? 1 : 0) + (m.useIgnoreReq ? 1 : 0),
  };
}

export function rushTarget(s: GameState, p: PlayerState): number {
  const from = p.position;
  let target: number;
  if (s.players.length === 1) target = from + s.ruleset.solo.rush;
  else {
    let ahead = Infinity;
    for (const o of s.players)
      if (o.id !== p.id && o.arrivalOrder === null && o.position > from && o.position < ahead)
        ahead = o.position;
    target = ahead === Infinity ? from + s.ruleset.rushNoPawnAhead : ahead + 1;
  }
  for (const id of p.tower) {
    const pw = s.cards[id].power;
    if (pw && pw.type === 'rush_bonus') target += pw.amount;
  }
  return Math.min(s.ruleset.trackLength, Math.max(from + 1, target));
}

export function rushFeatures(ctx: EvalContext, m: Extract<Move, { type: 'rush' }>): FeatureVec {
  const { s, me, r, cards } = ctx;
  const from = me.position;
  const to = rushTarget(s, me);
  const swaps = swapsGranted(s, me, from, to);
  let rushSwap = 0;
  if (swaps > 0 && me.tower.length >= 2) {
    const fut = futureDiscs(r, to, ctx.avgYears);
    const after = evalWithSwaps(r, cards, me.tower.slice(), ctx.allowance, fut, swaps).ev;
    rushSwap = after.total - ctx.baseWindow.total + 0.25 * (after.passion - ctx.baseWindow.passion);
  }
  return {
    rush: 1,
    cost: to - from,
    extraTurn: staysBehind(s, me, to) ? 1 : 0,
    rushDeny: m.discardCardId ? cardValueFor(s, ctx.nextPlayer, m.discardCardId) : 0,
    rushSwap,
    ageUnlock: (() => {
      const a0 = ageOf(r, from);
      const a1 = ageOf(r, to);
      return a0 !== null && a1 !== null && ageIndex(a1) > ageIndex(a0) ? 1 : 0;
    })(),
  };
}

/** Pick the best swap (or skip) for a pending choice by projected window value. */
export function chooseSwap(s: GameState, me: PlayerId, avgYears = 3.2): Move {
  const p = s.players.find((x) => x.id === me)!;
  const allowance = projectedAllowance(s, p);
  const fut = p.position >= s.ruleset.trackLength ? 0 : futureDiscs(s.ruleset, p.position, avgYears);
  const score = (t: readonly string[]) => {
    const ev = evalWindow(s.ruleset, s.cards, projectedSlice(t, allowance, fut));
    // also value the whole tower a little, so early swaps that build runs/sets count
    const whole = evalWindow(s.ruleset, s.cards, t);
    return ev.total + 0.25 * ev.passion + 0.1 * (whole.passion + whole.setFrac);
  };
  let best: Move = { type: 'skip_swap' };
  let bestV = score(p.tower) + 1e-9;
  for (let i = 0; i + 1 < p.tower.length; i++) {
    const t = p.tower.slice();
    const x = t[i];
    t[i] = t[i + 1];
    t[i + 1] = x;
    const v = score(t);
    if (v > bestV) {
      bestV = v;
      best = { type: 'swap', index: i };
    }
  }
  return best;
}

/** Target domains for specialists: the k domains with most discs (+ discount powers), stable order. */
export function targetDomains(s: GameState, p: PlayerState, k: number): string[] {
  if (k <= 0 || p.tower.length === 0) return [];
  const score: Record<string, number> = {};
  for (const d of DOMAINS) score[d] = 0;
  for (const id of p.tower) {
    const c = s.cards[id];
    score[c.color] += 1;
    if (c.power?.type === 'discount') score[c.power.color] += 0.75;
    if (c.reflection) score[c.reflection] += 1;
  }
  return DOMAINS.slice()
    .sort((a, b) => score[b] - score[a])
    .filter((d) => score[d] > 0)
    .slice(0, k);
}

export { turnPlayer };
