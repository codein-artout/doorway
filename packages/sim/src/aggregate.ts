#!/usr/bin/env tsx
// pnpm sim:aggregate — fold reports/runs/* into reports/data/ (CSV + summary.json + a move-log sample).

import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { createGzip, gunzipSync } from 'node:zlib';
import { STRATEGIES } from '@doorway/bots';
import { CARDS, DEFAULT_RULESET, soloRating, SOLO_RATINGS } from '@doorway/content';
import { cardsHash, rulesetHash } from '@doorway/engine';
import type { CardAgg } from './rows';
import { Acc, logistic, pearson, round, standardize, wilson } from './stats';

export const RUNS = path.join('reports', 'runs');
export const DATA = path.join('reports', 'data');

type Meta = {
  name: string;
  study: string | null;
  players: number;
  bots: string[];
  games: number;
  sweep: { key: string; values: string[] } | null;
  policyParams: Record<string, Record<string, number>>;
  variants: { label: string; ruleset: unknown }[];
};

type Row = Record<string, string>;

function readCsvGz(file: string): { header: string[]; lines: string[] } {
  const text = gunzipSync(readFileSync(file)).toString('utf8');
  const lines = text.split('\n').filter(Boolean);
  return { header: lines[0].split(','), lines: lines.slice(1) };
}

function toRow(header: string[], line: string): Row {
  const c = line.split(',');
  const o: Row = {};
  for (let i = 0; i < header.length; i++) o[header[i]] = c[i];
  return o;
}

class GzCsv {
  private s: ReturnType<typeof createGzip>;
  private done: Promise<void>;
  rows = 0;
  constructor(file: string, header: string[]) {
    this.s = createGzip({ level: 9 });
    const out = createWriteStream(file);
    this.s.pipe(out);
    this.done = new Promise((res) => out.on('finish', () => res()));
    this.s.write(header.join(',') + '\n');
  }
  write(line: string) {
    this.rows++;
    this.s.write(line + '\n');
  }
  async close() {
    this.s.end();
    await this.done;
  }
}

const num = (x: string | undefined) => (x === undefined || x === '' || x === 'null' ? NaN : Number(x));
const basePolicy = (p: string) => p.split('@')[0];

// ------------------------------------------------------------------ accumulators

type WinAcc = { n: number; w: number };
const winOf = (a: WinAcc) => {
  const c = wilson(a.w, a.n);
  return { n: a.n, win: round(c.p, 4), lo: round(c.lo, 4), hi: round(c.hi, 4) };
};

class Group {
  games = new Set<string>();
  turnsPerGame = new Acc();
  byPolicy: Record<
    string,
    WinAcc & { score: Acc; rush: Acc; lost: Acc; comp: Record<string, Acc>; extra: Acc; turns: Acc }
  > = {};
  bySeat: Record<string, WinAcc & { fair: number }> = {};
  byArrival: Record<string, { tower: Acc; lost: Acc; allowance: Acc; anyLost: Acc; kept: Acc }> = {};
  score = new Acc();
  scores: number[] = [];
  comp: Record<string, Acc> = {
    cards: new Acc(),
    full_life: new Acc(),
    passion: new Acc(),
    reflection: new Acc(),
  };
  rushBuckets: Record<string, WinAcc & { fair: number }> = {};
  turnsPerPlayer = new Acc();
  extraTurns = new Acc();
  extraShare = new Acc();
  noQuest = new Acc();
  noQuestShare = new Acc();
  rushes = new Acc();
  rushDist = new Acc();
  rushDiscardShare = new Acc();
  savedExp = new Acc();
  savedPow = new Acc();
  quests = new Acc();
  costBucket = [new Acc(), new Acc(), new Acc(), new Acc()];
  powersHeld: Record<string, number> = {};
  onceHeld = { age_reach_once: 0, ignore_requirement_once: 0, next_quest_discount: 0 };
  onceUsed = { age_reach_once: 0, ignore_requirement_once: 0, next_quest_discount: 0 };
  swaps = { made: 0, declined: 0, auto: 0 };
  players = 0;
  // for predictors (sampled)
  pred: { x: number[]; y: number }[] = [];

  add(r: Row) {
    const n = num(r.players);
    const pol = basePolicy(r.policy);
    const ws = num(r.win_share);
    this.players++;
    this.games.add(r.run + '|' + r.value + '|' + r.game);
    const p = (this.byPolicy[pol] ??= {
      n: 0,
      w: 0,
      score: new Acc(),
      rush: new Acc(),
      lost: new Acc(),
      extra: new Acc(),
      turns: new Acc(),
      comp: { cards: new Acc(), full_life: new Acc(), passion: new Acc(), reflection: new Acc() },
    });
    p.n++;
    p.w += ws;
    p.score.add(num(r.total));
    p.rush.add(num(r.rushes));
    p.lost.add(num(r.lost));
    p.extra.add(num(r.extra_turns));
    p.turns.add(num(r.turns));
    for (const k of Object.keys(p.comp)) p.comp[k].add(num(r[k]));
    const s = (this.bySeat[r.seat] ??= { n: 0, w: 0, fair: 0 });
    s.n++;
    s.w += ws;
    s.fair += 1 / n;
    const a = (this.byArrival[r.arrival] ??= {
      tower: new Acc(),
      lost: new Acc(),
      allowance: new Acc(),
      anyLost: new Acc(),
      kept: new Acc(),
    });
    a.tower.add(num(r.tower));
    a.lost.add(num(r.lost));
    a.allowance.add(num(r.allowance));
    a.anyLost.add(num(r.lost) > 0 ? 1 : 0);
    a.kept.add(num(r.kept));
    this.score.add(num(r.total));
    if (this.scores.length < 200_000) this.scores.push(num(r.total));
    for (const k of Object.keys(this.comp)) this.comp[k].add(num(r[k]));
    const rb = num(r.rushes);
    const bucket = rb === 0 ? '0' : rb === 1 ? '1' : rb === 2 ? '2' : rb <= 4 ? '3–4' : '5+';
    const b = (this.rushBuckets[bucket] ??= { n: 0, w: 0, fair: 0 });
    b.n++;
    b.w += ws;
    b.fair += 1 / n;
    const turns = num(r.turns);
    this.turnsPerPlayer.add(turns);
    this.extraTurns.add(num(r.extra_turns));
    if (turns > 0) this.extraShare.add(num(r.extra_turns) / turns);
    this.noQuest.add(num(r.no_quest_turns));
    if (turns > 0) this.noQuestShare.add(num(r.no_quest_turns) / turns);
    this.rushes.add(rb);
    if (rb > 0) {
      this.rushDist.add(num(r.rush_dist) / rb);
      this.rushDiscardShare.add(num(r.rush_discards) / rb);
    }
    this.savedExp.add(num(r.saved_exp));
    this.savedPow.add(num(r.saved_pow));
    this.quests.add(num(r.quests));
    for (let i = 0; i < 4; i++) {
      const c = num(r[`cost_b${i}`]);
      const k = num(r[`n_b${i}`]);
      if (k > 0) this.costBucket[i].add(c / k, k);
    }
    const gained = r.powers_gained ? r.powers_gained.split('|') : [];
    for (const g of gained) this.powersHeld[g] = (this.powersHeld[g] ?? 0) + 1;
    if (gained.includes('age_reach_once')) {
      this.onceHeld.age_reach_once++;
      if (r.used_age_reach === '1') this.onceUsed.age_reach_once++;
    }
    if (gained.includes('ignore_requirement_once')) {
      this.onceHeld.ignore_requirement_once++;
      if (r.used_ignore_req === '1') this.onceUsed.ignore_requirement_once++;
    }
    if (gained.includes('next_quest_discount')) {
      this.onceHeld.next_quest_discount++;
      if (num(r.used_next_quest) > 0) this.onceUsed.next_quest_discount++;
    }
    this.swaps.made += num(r.swaps_made);
    this.swaps.declined += num(r.swaps_declined);
    this.swaps.auto += num(r.swaps_auto);
    if (this.pred.length < 60_000)
      this.pred.push({
        x: [num(r.cards), num(r.full_life), num(r.passion), num(r.reflection), num(r.kept)],
        y: ws > 0 ? 1 : 0,
      });
  }

  addGame(turns: number) {
    this.turnsPerGame.add(turns);
  }

  summary() {
    const totalComp = Object.values(this.comp).reduce((s, a) => s + a.sum, 0) || 1;
    const nonFirst = Object.entries(this.byArrival).filter(([k]) => k !== '1');
    const nf = new Acc();
    for (const [, a] of nonFirst) nf.add(a.lost.mean, a.lost.n);
    const anyLost = new Acc();
    for (const [, a] of Object.entries(this.byArrival)) anyLost.add(a.anyLost.mean, a.anyLost.n);
    return {
      games: this.games.size,
      players: this.players,
      turnsPerGame: this.turnsPerGame.toJSON(),
      byPolicy: Object.fromEntries(
        Object.entries(this.byPolicy)
          .sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n)
          .map(([k, p]) => [
            k,
            {
              ...winOf(p),
              score: p.score.toJSON(),
              rushes: round(p.rush.mean, 3),
              lost: round(p.lost.mean, 3),
              extraTurns: round(p.extra.mean, 3),
              turns: round(p.turns.mean, 3),
              components: Object.fromEntries(Object.entries(p.comp).map(([c, a]) => [c, round(a.mean, 3)])),
            },
          ]),
      ),
      bySeat: Object.fromEntries(
        Object.entries(this.bySeat).map(([k, s]) => {
          const w = winOf(s);
          const fair = s.fair / s.n;
          return [
            k,
            {
              ...w,
              fair: round(fair, 4),
              diffPP: round((w.win - fair) * 100, 2),
              diffRel: round(w.win / fair - 1, 4),
            },
          ];
        }),
      ),
      byArrival: Object.fromEntries(
        Object.entries(this.byArrival)
          .sort()
          .map(([k, a]) => [
            k,
            {
              n: a.tower.n,
              allowance: round(a.allowance.mean, 3),
              tower: round(a.tower.mean, 3),
              towerSd: round(a.tower.sd, 3),
              kept: round(a.kept.mean, 3),
              lost: round(a.lost.mean, 3),
              lostSd: round(a.lost.sd, 3),
              shareLostAny: round(a.anyLost.mean, 4),
            },
          ]),
      ),
      nonFirstLost: round(nf.mean, 3),
      shareLostAny: round(anyLost.mean, 4),
      score: this.score.toJSON(),
      scoreHist: hist(this.scores, 5),
      components: Object.fromEntries(
        Object.entries(this.comp).map(([k, a]) => [
          k,
          { mean: round(a.mean, 3), share: round(a.sum / totalComp, 4) },
        ]),
      ),
      rushBuckets: Object.fromEntries(
        ['0', '1', '2', '3–4', '5+']
          .filter((k) => this.rushBuckets[k])
          .map((k) => {
            const b = this.rushBuckets[k];
            return [k, { ...winOf(b), fair: round(b.fair / b.n, 4) }];
          }),
      ),
      turnsPerPlayer: this.turnsPerPlayer.toJSON(),
      extraTurns: this.extraTurns.toJSON(),
      extraTurnShare: round(this.extraShare.mean, 4),
      noQuestTurns: this.noQuest.toJSON(),
      noQuestShare: round(this.noQuestShare.mean, 4),
      rushes: this.rushes.toJSON(),
      rushDistance: round(this.rushDist.mean, 3),
      rushDiscardShare: round(this.rushDiscardShare.mean, 4),
      quests: this.quests.toJSON(),
      savedExperience: this.savedExp.toJSON(),
      savedPowers: this.savedPow.toJSON(),
      costByLifeQuarter: this.costBucket.map((a) => round(a.mean, 3)),
      powersHeldPerPlayer: Object.fromEntries(
        Object.entries(this.powersHeld).map(([k, v]) => [k, round(v / this.players, 4)]),
      ),
      oncePowerUseRate: Object.fromEntries(
        Object.entries(this.onceHeld).map(([k, held]) => [
          k,
          {
            held,
            used: this.onceUsed[k as keyof typeof this.onceUsed],
            rate: held ? round(this.onceUsed[k as keyof typeof this.onceUsed] / held, 4) : null,
          },
        ]),
      ),
      swaps: this.swaps,
    };
  }

  predictors() {
    if (this.pred.length < 100) return null;
    const names = ['cards', 'full_life', 'passion', 'reflection', 'kept'];
    const cols = names.map((_, j) => this.pred.map((p) => p.x[j]));
    const y = this.pred.map((p) => p.y);
    const { Z } = standardize(cols);
    const beta = logistic(Z, y);
    return {
      method:
        'Logistic regression of "won (sole or shared)" on standardized components, IRLS; plus point-biserial r.',
      n: this.pred.length,
      coefficients: Object.fromEntries(names.map((nm, j) => [nm, round(beta[j + 1], 4)])),
      pointBiserial: Object.fromEntries(names.map((nm, j) => [nm, round(pearson(cols[j], y), 4)])),
    };
  }
}

function hist(xs: number[], w: number) {
  if (!xs.length) return null;
  let lo = Infinity,
    hi = -Infinity;
  for (const x of xs) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  lo = Math.floor(lo / w) * w;
  const bins = Math.floor((hi - lo) / w) + 1;
  const counts = new Array(bins).fill(0);
  for (const x of xs) counts[Math.floor((x - lo) / w)]++;
  return { lo, width: w, counts };
}

// ------------------------------------------------------------------ main

export async function aggregate(opts: { runs?: string; data?: string; quiet?: boolean } = {}) {
  const runsDir = opts.runs ?? RUNS;
  const dataDir = opts.data ?? DATA;
  mkdirSync(dataDir, { recursive: true });
  const runs = existsSync(runsDir)
    ? readdirSync(runsDir)
        .filter((d) => existsSync(path.join(runsDir, d, 'COMPLETE')))
        .sort()
    : [];
  const metas: Record<string, Meta> = {};
  for (const r of runs) metas[r] = JSON.parse(readFileSync(path.join(runsDir, r, 'meta.json'), 'utf8'));
  const studyOf = (r: string) => metas[r].study ?? 'adhoc';

  const gamesOut = new GzCsv(path.join(dataDir, 'games.csv.gz'), [
    'study',
    'run',
    'value',
    'game',
    'seed',
    'players',
    'policies',
    'turns',
    'winners',
    'arrival',
    'totals',
    'kept',
    'lost',
    'heights',
    'allowances',
    'rushes',
  ]);
  let playersHeader: string[] | null = null;
  let playersOut: GzCsv | null = null;

  // groups: main per player count, noisy, field baseline per sweep value, solo per policy
  const groups: Record<string, Group> = {};
  const G = (k: string) => (groups[k] ??= new Group());
  const matchup: Record<string, Record<string, WinAcc>> = {};
  const cardAgg: Record<string, Record<string, CardAgg>> = {}; // key: study/value
  const sweepGroups: Record<string, Record<string, Group>> = {};
  const solo: Record<string, { total: Acc; ratings: Record<string, number>; hist: number[] }> = {};
  const logs: string[] = [];

  for (const r of runs) {
    const study = studyOf(r);
    const meta = metas[r];
    const g = readCsvGz(path.join(runsDir, r, 'games.csv.gz'));
    for (const line of g.lines) {
      gamesOut.write(`${study},${line}`);
      const row = toRow(g.header, line);
      const key = groupKey(study, meta, row);
      if (key) G(key).addGame(num(row.turns));
      if (meta.sweep)
        ((sweepGroups[`${study}:${meta.sweep.key}`] ??= {})[row.value] ??= new Group()).addGame(
          num(row.turns),
        );
    }
    const p = readCsvGz(path.join(runsDir, r, 'players.csv.gz'));
    if (!playersHeader) {
      playersHeader = ['study', ...p.header];
      playersOut = new GzCsv(path.join(dataDir, 'players.csv.gz'), playersHeader);
    }
    for (const line of p.lines) {
      playersOut!.write(`${study},${line}`);
      const row = toRow(p.header, line);
      const key = groupKey(study, meta, row);
      if (key) G(key).add(row);
      if (meta.sweep)
        ((sweepGroups[`${study}:${meta.sweep.key}`] ??= {})[row.value] ??= new Group()).add(row);
      if (study === 'S1') {
        const [a, b] = meta.bots;
        const me = row.seat === '1' ? a : b;
        const opp = row.seat === '1' ? b : a;
        const m = ((matchup[me] ??= {})[opp] ??= { n: 0, w: 0 });
        m.n++;
        m.w += num(row.win_share);
      }
      if (study === 'S5') {
        const s = (solo[basePolicy(row.policy)] ??= { total: new Acc(), ratings: {}, hist: [] });
        const t = num(row.total);
        s.total.add(t);
        s.hist.push(t);
        const rt = soloRating(t);
        s.ratings[rt] = (s.ratings[rt] ?? 0) + 1;
      }
    }
    const cards = JSON.parse(readFileSync(path.join(runsDir, r, 'cards.json'), 'utf8')) as Record<
      string,
      Record<string, CardAgg>
    >;
    for (const [value, per] of Object.entries(cards)) {
      const k = `${study}/${meta.sweep ? value : 'base'}`;
      const agg = (cardAgg[k] ??= {});
      for (const [id, a] of Object.entries(per)) {
        const t = (agg[id] ??= { takeable: 0, picked: 0, pg: 0, winSum: 0, winSq: 0, fairSum: 0 });
        for (const f of Object.keys(t) as (keyof CardAgg)[]) t[f] += a[f];
      }
    }
    const lf = path.join(runsDir, r, 'logs.jsonl.gz');
    if (existsSync(lf))
      logs.push(...gunzipSync(readFileSync(lf)).toString('utf8').split('\n').filter(Boolean));
  }
  await gamesOut.close();
  if (playersOut) await playersOut.close();

  // ---- cards.csv (per study/value) and the card-balance table (S2 + S3)
  const cardById = Object.fromEntries(CARDS.map((c) => [c.id, c]));
  const cardLines = [
    'scope,card,name,age,domain,takeable,picked,pick_rate,picked_games,win_when_picked,fair,rel_win,rel_lo,rel_hi',
  ];
  const cardRow = (a: CardAgg) => {
    const m = a.pg ? a.winSum / a.pg : NaN;
    const v = a.pg ? Math.max(0, a.winSq / a.pg - m * m) : NaN;
    const se = a.pg ? Math.sqrt(v / a.pg) : NaN;
    const fair = a.pg ? a.fairSum / a.pg : NaN;
    return {
      pickRate: a.takeable ? a.picked / a.takeable : NaN,
      win: m,
      fair,
      rel: m / fair,
      lo: (m - 1.96 * se) / fair,
      hi: (m + 1.96 * se) / fair,
    };
  };
  for (const [scope, per] of Object.entries(cardAgg))
    for (const c of CARDS) {
      const a = per[c.id] ?? { takeable: 0, picked: 0, pg: 0, winSum: 0, winSq: 0, fairSum: 0 };
      const x = cardRow(a);
      cardLines.push(
        [
          scope,
          c.id,
          `"${c.name}"`,
          c.age,
          c.color,
          a.takeable,
          a.picked,
          round(x.pickRate, 4),
          a.pg,
          round(x.win, 4),
          round(x.fair, 4),
          round(x.rel, 4),
          round(x.lo, 4),
          round(x.hi, 4),
        ].join(','),
      );
    }
  writeFileSync(path.join(dataDir, 'cards.csv'), cardLines.join('\n') + '\n');
  const CARD_MARGIN = 0.1;
  const balanceScopes = Object.keys(cardAgg).filter((k) => k.startsWith('S2/') || k.startsWith('S3/'));
  const cardBalance = CARDS.map((c) => {
    const a: CardAgg = { takeable: 0, picked: 0, pg: 0, winSum: 0, winSq: 0, fairSum: 0 };
    for (const s of balanceScopes) {
      const b = cardAgg[s][c.id];
      if (b) for (const f of Object.keys(a) as (keyof CardAgg)[]) a[f] += b[f];
    }
    const x = cardRow(a);
    const flag = x.lo > 1 + CARD_MARGIN ? 'strong' : x.hi < 1 - CARD_MARGIN ? 'weak' : null;
    return {
      id: c.id,
      name: c.name,
      age: c.age,
      domain: c.color,
      years: c.years,
      points: c.points,
      power: c.power?.type ?? null,
      reflection: !!c.reflection,
      takeable: a.takeable,
      picked: a.picked,
      pickRate: round(x.pickRate, 4),
      pickedGames: a.pg,
      winWhenPicked: round(x.win, 4),
      fair: round(x.fair, 4),
      relWin: round(x.rel, 4),
      relLo: round(x.lo, 4),
      relHi: round(x.hi, 4),
      flag,
    };
  });
  void cardById;

  // ---- matchups.csv (S1)
  const ids = Object.keys(STRATEGIES);
  const mLines = ['policy,opponent,games,win,lo,hi'];
  const matrix: (number | null)[][] = ids.map((a) =>
    ids.map((b) => {
      const m = matchup[a]?.[b];
      if (!m) return null;
      const w = winOf(m);
      mLines.push([a, b, m.n, w.win, w.lo, w.hi].join(','));
      return w.win;
    }),
  );
  writeFileSync(path.join(dataDir, 'matchups.csv'), mLines.join('\n') + '\n');

  // ---- sweeps.csv
  const sweepSummary: Record<
    string,
    { value: string; base: boolean; summary: ReturnType<Group['summary']> }[]
  > = {};
  const sLines = [
    'scope,key,value,games,players,avg_score,turns_per_game,nonfirst_lost,share_lost_any,seat1_win,seat1_fair,top_policy,top_win,top_lo,top_hi,lost_by_arrival,components',
  ];
  for (const [scope, vals] of Object.entries(sweepGroups)) {
    const [study, key] = scope.split(':');
    const run = Object.values(metas).find((m) => m.study === study && m.sweep?.key === key)!;
    const order = run.sweep!.values.map((v) => `${key}=${v.replace(/,/g, '/')}`);
    const base = baseValueLabel(key);
    sweepSummary[scope] = order
      .filter((v) => vals[v])
      .map((v) => {
        const s = vals[v].summary();
        const top = Object.entries(s.byPolicy)[0];
        sLines.push(
          [
            study,
            key,
            v,
            s.games,
            run.players,
            s.score.mean,
            s.turnsPerGame.mean,
            s.nonFirstLost,
            s.shareLostAny,
            s.bySeat['1']?.win,
            s.bySeat['1']?.fair,
            top?.[0],
            top?.[1].win,
            top?.[1].lo,
            top?.[1].hi,
            Object.values(s.byArrival)
              .map((a) => a.lost)
              .join('/'),
            Object.values(s.components)
              .map((c) => c.share)
              .join('/'),
          ].join(','),
        );
        return { value: v, base: v === base, summary: s };
      });
  }
  writeFileSync(path.join(dataDir, 'sweeps.csv'), sLines.join('\n') + '\n');

  // ---- logs sample (1,000 games)
  const sample = logs.filter((_, i) => i % Math.max(1, Math.floor(logs.length / 1000)) === 0).slice(0, 1000);
  const lsOut = createGzip({ level: 9 });
  const lsFile = createWriteStream(path.join(dataDir, 'logs-sample.jsonl.gz'));
  lsOut.pipe(lsFile);
  for (const l of sample) lsOut.write(l + '\n');
  lsOut.end();
  await new Promise<void>((res) => lsFile.on('finish', () => res()));

  // ---- summary.json
  const main = Object.fromEntries(Object.entries(groups).map(([k, g]) => [k, g.summary()]));
  const predictors = Object.fromEntries(
    Object.entries(groups)
      .filter(([k]) => k.startsWith('main-'))
      .map(([k, g]) => [k, g.predictors()]),
  );
  const summary = {
    generatedAt: new Date().toISOString(),
    ruleset: { id: DEFAULT_RULESET.id, hash: rulesetHash(DEFAULT_RULESET) },
    cardsHash: cardsHash(CARDS),
    strategies: Object.fromEntries(
      Object.entries(STRATEGIES).map(([k, v]) => [
        k,
        { label: v.label, kind: v.kind, params: v.params ?? {} },
      ]),
    ),
    runs: runs.map((r) => ({
      name: r,
      study: studyOf(r),
      players: metas[r].players,
      games: metas[r].games,
      values: metas[r].variants.length,
    })),
    totals: {
      games: runs.reduce((s, r) => s + metas[r].games * metas[r].variants.length, 0),
      byStudy: runs.reduce<Record<string, number>>((acc, r) => {
        acc[studyOf(r)] = (acc[studyOf(r)] ?? 0) + metas[r].games * metas[r].variants.length;
        return acc;
      }, {}),
    },
    groups: main,
    predictors,
    matchups: { ids, matrix },
    cards: { margin: CARD_MARGIN, scopes: balanceScopes, table: cardBalance },
    sweeps: sweepSummary,
    solo: Object.fromEntries(
      Object.entries(solo).map(([k, s]) => [
        k,
        {
          games: s.total.n,
          score: s.total.toJSON(),
          ratings: Object.fromEntries(
            SOLO_RATINGS.map((b) => [b.label, round((s.ratings[b.label] ?? 0) / s.total.n, 4)]),
          ),
          hist: hist(s.hist, 5),
        },
      ]),
    ),
  };
  writeFileSync(path.join(dataDir, 'summary.json'), JSON.stringify(summary, null, 1));
  await writeParquet(dataDir).catch((e) =>
    writeFileSync(path.join(dataDir, 'PARQUET.txt'), `Parquet export skipped: ${String(e)}\n`),
  );
  if (!opts.quiet) {
    console.log(`Aggregated ${runs.length} runs → ${dataDir}`);
    for (const f of readdirSync(dataDir))
      console.log(`  ${f.padEnd(26)} ${(statSync(path.join(dataDir, f)).size / 1e6).toFixed(2)} MB`);
  }
  return summary;
}

/** Which summary group a row belongs to (main study numbers per player count, noisy field, solo). */
function groupKey(study: string, meta: Meta, row: Row): string | null {
  if (study === 'S1' || study === 'S2') return `main-${row.players}p`;
  if (study === 'S3') return 'noisy-4p';
  if (study === 'S5') return 'solo';
  if (study === 'adhoc') return `adhoc-${row.players}p`;
  void meta;
  return null;
}

/** The value label of the default ruleset for a sweep key. */
export function baseValueLabel(key: string): string {
  const v = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], DEFAULT_RULESET);
  if (Array.isArray(v)) return `${key}=${v.join('/')}`;
  if (v && typeof v === 'object')
    return `${key}=${Object.keys(v)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (v as Record<string, number>)[k])
      .join('/')}`;
  return `${key}=${String(v)}`;
}

/** Parquet copies of the two big tables, if the pure-JS writer is available. */
async function writeParquet(dataDir: string) {
  const mod = (await import('hyparquet-writer')) as {
    parquetWriteBuffer: (o: {
      columnData: { name: string; data: unknown[]; type?: string }[];
    }) => ArrayBuffer;
  };
  for (const name of ['games', 'players']) {
    const { header, lines } = readCsvGz(path.join(dataDir, `${name}.csv.gz`));
    const cols = header.map((h) => ({ name: h, data: [] as unknown[] }));
    const numeric = header.map(
      (h) =>
        ![
          'study',
          'run',
          'value',
          'seed',
          'policies',
          'policy',
          'winners',
          'arrival',
          'totals',
          'kept',
          'lost',
          'heights',
          'allowances',
          'rushes',
          'powers_gained',
        ].includes(h) ||
        (name === 'players' && ['kept', 'lost', 'rushes'].includes(h)),
    );
    for (const l of lines) {
      const c = l.split(',');
      for (let i = 0; i < header.length; i++)
        cols[i].data.push(numeric[i] ? (c[i] === '' || c[i] === 'null' ? null : Number(c[i])) : c[i]);
    }
    const buf = mod.parquetWriteBuffer({
      columnData: cols.map((c, i) => ({ ...c, type: numeric[i] ? 'DOUBLE' : 'STRING' })),
    });
    writeFileSync(path.join(dataDir, `${name}.parquet`), Buffer.from(buf));
  }
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('sim', 'src', 'aggregate.ts'));
if (isMain)
  aggregate().catch((e) => {
    console.error(e);
    process.exit(1);
  });
