// One simulation run: (sweep values × games) split into resumable chunks, then merged into CSVs.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { applyOverrides, assertValidRuleset, parseOverrideValue, type Ruleset } from '@doorway/engine';
import type { ChunkResult, ChunkTask } from './chunk';
import type { Pool } from './pool';
import { GAME_COLUMNS, PICK_COLUMNS, PLAYER_COLUMNS, type CardAgg } from './rows';
import { gameSeed, seatsFor, type SeatMode } from './schedule';
import { Acc, round, wilson } from './stats';

export type SimConfig = {
  name: string;
  outDir: string;
  players: number;
  bots: string[];
  seats: SeatMode;
  games: number;
  seed: string;
  ruleset: Ruleset;
  /** base overrides applied before the sweep (dotted paths) */
  set?: Record<string, string>;
  /** one sweep key with its values (each value = a variant) */
  sweep?: { key: string; values: string[] };
  shard?: { index: number; count: number };
  resume?: boolean;
  chunkSize?: number;
  logsBelow?: number;
  policyParams?: Record<string, Record<string, number>>;
  quiet?: boolean;
  /** explicit seatings: game g uses seatList[g mod length] (overrides `seats`) */
  seatList?: string[][];
  /** study id for aggregation (S1…S5) */
  study?: string;
};

export type Variant = { label: string; ruleset: Ruleset };

export function variantsOf(cfg: SimConfig): Variant[] {
  const base = cfg.set && Object.keys(cfg.set).length ? applyOverrides(cfg.ruleset, cfg.set) : cfg.ruleset;
  if (!cfg.sweep) return [{ label: 'base', ruleset: base }];
  return cfg.sweep.values.map((v) => {
    // labels never contain commas (they go into CSV cells): lists are written with '/'
    const label = `${cfg.sweep!.key}=${v.replace(/,/g, '/')}`;
    const r = applyOverrides(base, { [cfg.sweep!.key]: parseOverrideValue(v) }, `${base.id}+${label}`);
    assertValidRuleset(r);
    return { label, ruleset: r };
  });
}

const chunkFile = (dir: string, v: number, c: number) =>
  path.join(dir, 'chunks', `v${v}-c${String(c).padStart(5, '0')}.json.gz`);

export function chunkPlan(cfg: SimConfig) {
  const size = cfg.chunkSize ?? 250;
  const perValue = Math.ceil(cfg.games / size);
  const variants = variantsOf(cfg);
  const plan: { v: number; c: number; from: number; to: number }[] = [];
  variants.forEach((_, v) => {
    for (let c = 0; c < perValue; c++)
      plan.push({ v, c, from: c * size, to: Math.min(cfg.games, (c + 1) * size) });
  });
  return { plan, variants };
}

export type RunProgress = { done: number; total: number; skipped: number; ms: number };

/** Play every chunk this shard owns that isn't on disk yet; merge outputs when the run is complete. */
export async function runSim(
  cfg: SimConfig,
  pool: Pool,
  onProgress?: (p: RunProgress) => void,
): Promise<{ complete: boolean; dir: string }> {
  const dir = cfg.outDir;
  mkdirSync(path.join(dir, 'chunks'), { recursive: true });
  const { plan, variants } = chunkPlan(cfg);
  writeFileSync(
    path.join(dir, 'meta.json'),
    JSON.stringify(
      {
        name: cfg.name,
        study: cfg.study ?? null,
        players: cfg.players,
        bots: cfg.bots,
        seats: cfg.seats,
        games: cfg.games,
        seed: cfg.seed,
        rulesetId: cfg.ruleset.id,
        set: cfg.set ?? {},
        sweep: cfg.sweep ?? null,
        policyParams: cfg.policyParams ?? {},
        variants: variants.map((v) => ({ label: v.label, ruleset: v.ruleset })),
        chunks: plan.length,
        seatListLength: cfg.seatList?.length ?? null,
      },
      null,
      2,
    ),
  );
  const mine = plan.filter((_, i) => !cfg.shard || i % cfg.shard.count === cfg.shard.index - 1);
  const todo = mine.filter((p) => !(cfg.resume && existsSync(chunkFile(dir, p.v, p.c))));
  const prog: RunProgress = { done: 0, total: todo.length, skipped: mine.length - todo.length, ms: 0 };
  const t0 = Date.now();
  await Promise.all(
    todo.map(async (p) => {
      const variant = variants[p.v];
      const games: ChunkTask['games'] = [];
      for (let g = p.from; g < p.to; g++)
        games.push({
          index: g,
          seed: gameSeed(cfg.seed, g),
          policies: cfg.seatList
            ? cfg.seatList[g % cfg.seatList.length]
            : seatsFor(cfg.seats, cfg.bots, cfg.players, g, cfg.seed),
        });
      const res = await pool.run({
        id: `${cfg.name}/${p.v}/${p.c}`,
        run: cfg.name,
        value: variant.label,
        ruleset: variant.ruleset,
        games,
        logsBelow: cfg.logsBelow ?? 0,
        policyParams: cfg.policyParams,
      });
      const f = chunkFile(dir, p.v, p.c);
      writeFileSync(f + '.tmp', gzipSync(JSON.stringify({ ...res, ms: 0 })));
      renameSync(f + '.tmp', f);
      prog.done++;
      prog.ms = Date.now() - t0;
      onProgress?.(prog);
    }),
  );
  const complete = plan.every((p) => existsSync(chunkFile(dir, p.v, p.c)));
  if (complete) mergeRun(dir, plan);
  return { complete, dir };
}

/** Merge all chunks (in plan order) into games/players/picks CSVs, cards.json, logs and a summary. */
export function mergeRun(dir: string, plan?: { v: number; c: number }[]): void {
  const files = plan
    ? plan.map((p) => chunkFile(dir, p.v, p.c))
    : readdirSync(path.join(dir, 'chunks'))
        .filter((f) => f.endsWith('.json.gz'))
        .sort()
        .map((f) => path.join(dir, 'chunks', f));
  const games = [GAME_COLUMNS.join(',')];
  const players = [PLAYER_COLUMNS.join(',')];
  const picks = [PICK_COLUMNS.join(',')];
  const logs: string[] = [];
  const cards: Record<string, Record<string, CardAgg>> = {};
  for (const f of files) {
    const r = JSON.parse(gunzipSync(readFileSync(f)).toString('utf8')) as ChunkResult;
    games.push(...r.games);
    players.push(...r.players);
    picks.push(...r.picks);
    logs.push(...r.logs);
    const value = r.games[0]?.split(',')[1] ?? 'base';
    const agg = (cards[value] ??= {});
    for (const [id, a] of Object.entries(r.cards)) {
      const t = (agg[id] ??= { takeable: 0, picked: 0, pg: 0, winSum: 0, winSq: 0, fairSum: 0 });
      t.takeable += a.takeable;
      t.picked += a.picked;
      t.pg += a.pg;
      t.winSum += a.winSum;
      t.winSq += a.winSq;
      t.fairSum += a.fairSum;
    }
  }
  writeFileSync(path.join(dir, 'games.csv.gz'), gzipSync(games.join('\n') + '\n'));
  writeFileSync(path.join(dir, 'players.csv.gz'), gzipSync(players.join('\n') + '\n'));
  writeFileSync(path.join(dir, 'picks.csv.gz'), gzipSync(picks.join('\n') + '\n'));
  writeFileSync(path.join(dir, 'cards.json'), JSON.stringify(cards));
  if (logs.length) writeFileSync(path.join(dir, 'logs.jsonl.gz'), gzipSync(logs.join('\n') + '\n'));
  writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summarizeRun(players), null, 2));
  writeFileSync(path.join(dir, 'COMPLETE'), new Date(0).toISOString());
}

export function parseCsv(lines: string[]): Record<string, string>[] {
  const header = lines[0].split(',');
  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cells = lines[i].split(',');
    const o: Record<string, string> = {};
    header.forEach((h, j) => (o[h] = cells[j]));
    out.push(o);
  }
  return out;
}

export type RunSummary = Record<
  string,
  {
    games: number;
    byPolicy: Record<
      string,
      {
        n: number;
        win: number;
        lo: number;
        hi: number;
        score: ReturnType<Acc['toJSON']>;
        rushes: number;
        lost: number;
      }
    >;
    bySeat: Record<string, { n: number; win: number; lo: number; hi: number; fair: number }>;
    turns: ReturnType<Acc['toJSON']>;
    lostByArrival: Record<string, ReturnType<Acc['toJSON']>>;
    towerByArrival: Record<string, ReturnType<Acc['toJSON']>>;
    components: Record<string, number>;
  }
>;

/** Per-value summary of a run (printed by the CLI and saved as summary.json). */
export function summarizeRun(playerLines: string[]): RunSummary {
  const rows = parseCsv(playerLines);
  const out: RunSummary = {};
  const acc: Record<
    string,
    {
      pol: Record<string, { n: number; w: number; sc: Acc; r: number; l: number }>;
      seat: Record<string, { n: number; w: number; fair: number }>;
      turns: Acc;
      lost: Record<string, Acc>;
      tower: Record<string, Acc>;
      comp: Record<string, number>;
      games: Set<string>;
      np: number;
    }
  > = {};
  for (const r of rows) {
    const a = (acc[r.value] ??= {
      pol: {},
      seat: {},
      turns: new Acc(),
      lost: {},
      tower: {},
      comp: { cards: 0, full_life: 0, passion: 0, reflection: 0 },
      games: new Set(),
      np: 0,
    });
    a.np++;
    const p = (a.pol[r.policy] ??= { n: 0, w: 0, sc: new Acc(), r: 0, l: 0 });
    p.n++;
    p.w += Number(r.win_share);
    p.sc.add(Number(r.total));
    p.r += Number(r.rushes);
    p.l += Number(r.lost);
    const s = (a.seat[r.seat] ??= { n: 0, w: 0, fair: 0 });
    s.n++;
    s.w += Number(r.win_share);
    s.fair += 1 / Number(r.players);
    if (!a.games.has(r.game)) {
      a.games.add(r.game);
    }
    (a.lost[r.arrival] ??= new Acc()).add(Number(r.lost));
    (a.tower[r.arrival] ??= new Acc()).add(Number(r.tower));
    for (const k of ['cards', 'full_life', 'passion', 'reflection']) a.comp[k] += Number(r[k]);
    a.turns.add(Number(r.turns));
  }
  for (const [v, a] of Object.entries(acc)) {
    const tot = Object.values(a.comp).reduce((x, y) => x + y, 0) || 1;
    out[v] = {
      games: a.games.size,
      byPolicy: Object.fromEntries(
        Object.entries(a.pol).map(([k, p]) => {
          const ci = wilson(p.w, p.n);
          return [
            k,
            {
              n: p.n,
              win: round(ci.p, 4),
              lo: round(ci.lo, 4),
              hi: round(ci.hi, 4),
              score: p.sc.toJSON(),
              rushes: round(p.r / p.n, 3),
              lost: round(p.l / p.n, 3),
            },
          ];
        }),
      ),
      bySeat: Object.fromEntries(
        Object.entries(a.seat).map(([k, s]) => {
          const ci = wilson(s.w, s.n);
          return [
            k,
            {
              n: s.n,
              win: round(ci.p, 4),
              lo: round(ci.lo, 4),
              hi: round(ci.hi, 4),
              fair: round(s.fair / s.n, 4),
            },
          ];
        }),
      ),
      turns: a.turns.toJSON(),
      lostByArrival: Object.fromEntries(Object.entries(a.lost).map(([k, x]) => [k, x.toJSON()])),
      towerByArrival: Object.fromEntries(Object.entries(a.tower).map(([k, x]) => [k, x.toJSON()])),
      components: Object.fromEntries(Object.entries(a.comp).map(([k, x]) => [k, round(x / tot, 4)])),
    };
  }
  return out;
}

export function printSummary(s: RunSummary): string {
  const lines: string[] = [];
  for (const [v, x] of Object.entries(s)) {
    lines.push(`\n== ${v} — ${x.games} games, ${x.turns.mean} turns/player (sd ${x.turns.sd})`);
    lines.push('policy                 n      win    95% CI           score (sd)     rushes  lost');
    for (const [k, p] of Object.entries(x.byPolicy).sort((a, b) => b[1].win - a[1].win))
      lines.push(
        `${k.padEnd(20)} ${String(p.n).padStart(6)}  ${p.win.toFixed(3)}  [${p.lo.toFixed(3)}, ${p.hi.toFixed(3)}]  ${String(p.score.mean.toFixed(1)).padStart(5)} (${p.score.sd.toFixed(1)})  ${p.rushes.toFixed(2).padStart(6)}  ${p.lost.toFixed(2)}`,
      );
    lines.push('seat  win    fair   95% CI');
    for (const [k, p] of Object.entries(x.bySeat))
      lines.push(
        `${k.padEnd(4)}  ${p.win.toFixed(3)}  ${p.fair.toFixed(3)}  [${p.lo.toFixed(3)}, ${p.hi.toFixed(3)}]`,
      );
    lines.push('arrival  tower  lost');
    for (const k of Object.keys(x.lostByArrival).sort())
      lines.push(
        `${k.padEnd(7)}  ${x.towerByArrival[k].mean.toFixed(2)}  ${x.lostByArrival[k].mean.toFixed(2)}`,
      );
    lines.push(
      `score share: ${Object.entries(x.components)
        .map(([k, c]) => `${k} ${(c * 100).toFixed(1)}%`)
        .join(' · ')}`,
    );
  }
  return lines.join('\n');
}
