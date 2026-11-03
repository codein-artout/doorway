// Sandbox: ruleset dials, diffs and in-browser sim aggregation (pure; shared by the page and its workers).

import { getPolicy, playGame } from '@doorway/bots';
import { applyOverrides, getByPath, Rng, validateRuleset, type Card, type Ruleset } from '@doorway/engine';

export type Dial = { group: string; key: string; note: string; min: number; max: number };

export const DIALS: Dial[] = [
  { group: 'Track and time', key: 'trackLength', note: 'spaces to the Doorway', min: 30, max: 50 },
  { group: 'Track and time', key: 'milestones', note: 'count, evenly spaced (10/20/30)', min: 0, max: 4 },
  { group: 'Market', key: 'market.young', note: 'face-up Young cards', min: 1, max: 4 },
  { group: 'Market', key: 'market.middle', note: 'face-up Middle cards', min: 1, max: 4 },
  { group: 'Market', key: 'market.old', note: 'face-up Old cards', min: 1, max: 4 },
  { group: 'Costs and experience', key: 'experienceStep', note: 'discs per −1 year', min: 1, max: 4 },
  { group: 'Costs and experience', key: 'experienceCap', note: 'largest discount (RULINGS R1)', min: 0, max: 6 },
  { group: 'Costs and experience', key: 'minCost', note: 'cheapest a quest can be (0 allowed, R42)', min: 0, max: 3 },
  { group: 'Rush', key: 'rushNoPawnAhead', note: 'spaces when no pawn is ahead', min: 1, max: 6 },
  { group: 'Rush', key: 'rushDiscard', note: '1 = may discard a market card', min: 0, max: 1 },
  { group: 'Doorway (4 players)', key: 'doorway.4.0', note: 'discs kept, 1st arrival', min: 1, max: 14 },
  { group: 'Doorway (4 players)', key: 'doorway.4.1', note: '2nd arrival', min: 1, max: 14 },
  { group: 'Doorway (4 players)', key: 'doorway.4.2', note: '3rd arrival', min: 1, max: 14 },
  { group: 'Doorway (4 players)', key: 'doorway.4.3', note: '4th arrival', min: 1, max: 14 },
  { group: 'Scoring', key: 'fullLifeBonus', note: 'per set of all five', min: 0, max: 12 },
  { group: 'Scoring', key: 'passion.3', note: 'run of 3', min: 0, max: 10 },
  { group: 'Scoring', key: 'passion.4', note: 'run of 4', min: 0, max: 14 },
  { group: 'Scoring', key: 'passion.5', note: 'run of 5 or more', min: 0, max: 20 },
  { group: 'Scoring', key: 'reflectionPerDisc', note: 'per kept disc of its domain', min: 0, max: 3 },
];

export function dialValue(r: Ruleset, key: string): number {
  if (key === 'milestones') return r.milestones.length;
  if (key === 'rushDiscard') return r.rushDiscard ? 1 : 0;
  return Number(getByPath(r, key) ?? 0);
}

/** Set one dial, keeping the ruleset valid (R43): the Old band and Milestones follow the track length. */
export function setDial(r: Ruleset, key: string, v: number): Ruleset {
  if (key === 'rushDiscard') return applyOverrides(r, { rushDiscard: v === 1 });
  if (key === 'milestones' || key === 'trackLength') {
    const L = key === 'trackLength' ? v : r.trackLength;
    const count = key === 'milestones' ? v : r.milestones.length;
    const step = Math.floor(L / (count + 1));
    const ms = Array.from({ length: count }, (_, i) => (i + 1) * step);
    const mid = r.ageBands.middle;
    const old: [number, number] = [mid[1] + 1, L - 1];
    return applyOverrides(r, { trackLength: L, milestones: key === 'milestones' || L !== 40 ? ms : r.milestones, 'ageBands.old': old });
  }
  return applyOverrides(r, { [key]: v });
}

export function diff(base: Ruleset, v: Ruleset): { key: string; from: string; to: string }[] {
  const out: { key: string; from: string; to: string }[] = [];
  const walk = (a: unknown, b: unknown, p: string) => {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b as object)])) walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], p ? `${p}.${k}` : k);
      return;
    }
    out.push({ key: p, from: JSON.stringify(a), to: JSON.stringify(b) });
  };
  const { id: _a, ...ra } = base;
  const { id: _b, ...rb } = v;
  walk(ra, rb, '');
  return out;
}

export const BOT_MIXES = {
  field: { label: 'All strategies, seats drawn per game', bots: ['greedy', 'specialist', 'generalist', 'early_leaver', 'late_bloomer', 'tempo', 'rusher', 'set_collector', 'passion_specialist'] },
  archetypes: { label: 'Four archetypes (spec), rotating seats', bots: ['specialist', 'generalist', 'early_leaver', 'late_bloomer'] },
  lookahead: { label: 'Lookahead vs field', bots: ['lookahead', 'greedy', 'specialist', 'tempo'] },
} as const;
export type BotMix = keyof typeof BOT_MIXES;

export type SimAgg = {
  games: number;
  win: Record<string, { n: number; w: number }>;
  seat: Record<string, { n: number; w: number; fair: number }>;
  score: number;
  lost: Record<string, { n: number; sum: number }>;
  turns: number;
  comp: { cards: number; fullLife: number; passion: number; reflection: number };
  rushes: number;
  players: number;
};

export const emptyAgg = (): SimAgg => ({ games: 0, win: {}, seat: {}, score: 0, lost: {}, turns: 0, comp: { cards: 0, fullLife: 0, passion: 0, reflection: 0 }, rushes: 0, players: 0 });

export function seatsFor(mix: BotMix, players: number, g: number, seed: string): string[] {
  const bots = BOT_MIXES[mix].bots as readonly string[];
  if (mix === 'field') {
    const rng = Rng.fromSeed(`sandbox|${seed}|${g}`);
    return Array.from({ length: players }, () => rng.pick(bots));
  }
  return Array.from({ length: players }, (_, i) => bots[(i + g) % bots.length]);
}

export function runBatch(o: { ruleset: Ruleset; cards: Card[]; players: number; mix: BotMix; seed: string; from: number; to: number }): SimAgg {
  const a = emptyAgg();
  for (let g = o.from; g < o.to; g++) {
    const seats = seatsFor(o.mix, o.players, g, o.seed).map((p) => ({ policy: p }));
    const pols = seats.map((s) => getPolicy(s.policy, s.policy === 'lookahead' ? { params: { determinizations: 4 } } : undefined));
    const r = playGame({ ruleset: o.ruleset, cards: o.cards, seats, seed: `${o.seed}|g${g}`, policies: pols });
    a.games++;
    a.turns += r.turns;
    r.scores.forEach((s, i) => {
      const pol = seats[i].policy;
      const w = (a.win[pol] ??= { n: 0, w: 0 });
      w.n++;
      w.w += s.winShare;
      const st = (a.seat[i + 1] ??= { n: 0, w: 0, fair: 0 });
      st.n++;
      st.w += s.winShare;
      st.fair += 1 / o.players;
      a.score += s.total;
      a.players++;
      const l = (a.lost[s.arrivalOrder ?? 0] ??= { n: 0, sum: 0 });
      l.n++;
      l.sum += s.discsLost;
      a.comp.cards += s.cards;
      a.comp.fullLife += s.fullLife;
      a.comp.passion += s.passion;
      a.comp.reflection += s.reflection;
      a.rushes += r.stats[s.playerId].rushes;
    });
  }
  return a;
}

export function mergeAgg(x: SimAgg, y: SimAgg): SimAgg {
  const out = JSON.parse(JSON.stringify(x)) as SimAgg;
  out.games += y.games;
  out.turns += y.turns;
  out.score += y.score;
  out.players += y.players;
  out.rushes += y.rushes;
  for (const k of Object.keys(out.comp) as (keyof SimAgg['comp'])[]) out.comp[k] += y.comp[k];
  for (const [k, v] of Object.entries(y.win)) {
    const t = (out.win[k] ??= { n: 0, w: 0 });
    t.n += v.n;
    t.w += v.w;
  }
  for (const [k, v] of Object.entries(y.seat)) {
    const t = (out.seat[k] ??= { n: 0, w: 0, fair: 0 });
    t.n += v.n;
    t.w += v.w;
    t.fair += v.fair;
  }
  for (const [k, v] of Object.entries(y.lost)) {
    const t = (out.lost[k] ??= { n: 0, sum: 0 });
    t.n += v.n;
    t.sum += v.sum;
  }
  return out;
}

export function metrics(a: SimAgg) {
  const nonFirst = Object.entries(a.lost).filter(([k]) => k !== '1');
  const nf = nonFirst.reduce((s, [, v]) => s + v.sum, 0) / Math.max(1, nonFirst.reduce((s, [, v]) => s + v.n, 0));
  const top = Object.entries(a.win).sort((p, q) => q[1].w / q[1].n - p[1].w / p[1].n)[0];
  const seat1 = a.seat['1'];
  const tot = a.comp.cards + a.comp.fullLife + a.comp.passion + a.comp.reflection || 1;
  return [
    { name: 'Average score', v: a.score / Math.max(1, a.players), fmt: (x: number) => x.toFixed(1), better: 0 },
    { name: 'Turns per game', v: a.turns / Math.max(1, a.games), fmt: (x: number) => x.toFixed(1), better: 0 },
    { name: 'Discs lost (non-first arrivals)', v: nf, fmt: (x: number) => x.toFixed(2), better: 0 },
    { name: `Top strategy win (${top?.[0] ?? '—'})`, v: top ? top[1].w / top[1].n : NaN, fmt: (x: number) => `${(x * 100).toFixed(1)}%`, better: -1 },
    { name: 'Seat 1 win − fair (pts)', v: seat1 ? ((seat1.w - seat1.fair) / seat1.n) * 100 : NaN, fmt: (x: number) => x.toFixed(1), better: 0 },
    { name: 'Rushes per player', v: a.rushes / Math.max(1, a.players), fmt: (x: number) => x.toFixed(2), better: 0 },
    { name: 'Full life share of points', v: a.comp.fullLife / tot, fmt: (x: number) => `${(x * 100).toFixed(1)}%`, better: 0 },
    { name: 'Passion share of points', v: a.comp.passion / tot, fmt: (x: number) => `${(x * 100).toFixed(1)}%`, better: 0 },
  ];
}

export const rulesetProblems = (r: Ruleset) => validateRuleset(r);
