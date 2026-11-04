#!/usr/bin/env tsx
// pnpm sim — headless Doorway simulations.
//
//   pnpm sim --players 4 --bots tempo,specialist,lookahead,greedy --games 10000 \
//     --seats rotate --seed doorway-2026 --ruleset v0.2-default \
//     --sweep 'doorway.4=9,8,7,6;10,7,5,3' --workers 4 --shard 1/8 --resume --out reports/runs/<name>

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { STRATEGY_IDS } from '@doorway/bots';
import { getRuleset } from '@doorway/content';
import { assertValidRuleset, type Ruleset } from '@doorway/engine';
import { defaultWorkers, Pool } from './pool';
import { printSummary, runSim, type SimConfig, type RunSummary } from './run';
import type { SeatMode } from './schedule';

const HELP = `pnpm sim [options]
  --players N            2–4, or 1 for solo (default 4)
  --bots a,b,c           strategy ids (${STRATEGY_IDS.join(', ')}); add @eps0.1 for noisy variants
  --games N              games per sweep value (default 1000)
  --seats MODE           rotate | fixed | all-permutations | field  (default rotate)
  --seed S               base seed (default doorway-2026)
  --ruleset ID|FILE      built-in id or a JSON file (default v0.2-default)
  --set key=value        base override by dotted path (repeatable), e.g. --set experienceStep=3
  --sweep 'key=a;b;c'    run every value of one key; values separated by ';' (quote it)
  --workers N            worker threads (default min(4, cores))
  --shard i/n            only this shard's chunks
  --resume               skip chunks already on disk
  --chunk N              games per chunk (default 250)
  --logs N               keep full move logs for the first N games of each value
  --param strat.key=v    override a strategy parameter (e.g. lookahead.determinizations=4)
  --out DIR              output directory (default reports/runs/<name>)
  --name NAME            run name (default from the arguments)
  --quiet                no progress output`;

class HelpRequested extends Error {}

export function parseArgs(argv: string[]) {
  const a: Record<string, string[]> = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) throw new Error(`Unexpected argument "${t}"`);
    const [k, inline] = t.slice(2).split(/=(.*)/s, 2);
    const flag = ['resume', 'quiet', 'help'].includes(k);
    const v = flag ? 'true' : (inline ?? argv[++i]);
    if (v === undefined) throw new Error(`--${k} needs a value`);
    (a[k] ??= []).push(v);
  }
  return a;
}

function loadRuleset(spec: string): Ruleset {
  if (spec.endsWith('.json')) {
    const r = JSON.parse(readFileSync(spec, 'utf8'));
    assertValidRuleset(r);
    return r;
  }
  return getRuleset(spec);
}

export function configFromArgs(argv: string[]): SimConfig & { workers: number } {
  const a = parseArgs(argv);
  if (a.help) throw new HelpRequested();
  const one = (k: string, d?: string) => a[k]?.[a[k].length - 1] ?? d;
  const players = Number(one('players', '4'));
  const bots = (one('bots', 'greedy,tempo,specialist,generalist') as string)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const seats = one('seats', 'rotate') as SeatMode;
  if (!['rotate', 'fixed', 'all-permutations', 'field'].includes(seats))
    throw new Error(`Unknown --seats ${seats}`);
  const games = Number(one('games', '1000'));
  const seed = one('seed', 'doorway-2026')!;
  if (seed.includes(',')) throw new Error('--seed may not contain commas');
  const ruleset = loadRuleset(one('ruleset', 'v0.2-default')!);
  const set: Record<string, string> = {};
  for (const kv of a.set ?? []) {
    const [k, v] = kv.split(/=(.*)/s, 2);
    set[k] = v;
  }
  let sweep: SimConfig['sweep'];
  const sw = one('sweep');
  if (sw) {
    const [key, vals] = sw.split(/=(.*)/s, 2);
    sweep = {
      key,
      values: vals
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }
  let shard: SimConfig['shard'];
  const sh = one('shard');
  if (sh) {
    const [i, n] = sh.split('/').map(Number);
    if (!(i >= 1 && i <= n)) throw new Error(`Bad --shard ${sh}`);
    shard = { index: i, count: n };
  }
  const policyParams: Record<string, Record<string, number>> = {};
  for (const kv of a.param ?? []) {
    const [k, v] = kv.split('=');
    const [strat, key] = k.split('.');
    (policyParams[strat] ??= {})[key] = Number(v);
  }
  const name =
    one('name') ??
    `${players}p-${bots.join('_').replace(/[@.]/g, '-')}-${seats}-${games}${sweep ? '-sweep-' + sweep.key : ''}`.slice(
      0,
      120,
    );
  return {
    name,
    outDir: one('out') ?? path.join('reports', 'runs', name),
    players,
    bots,
    seats,
    games,
    seed,
    ruleset,
    set,
    sweep,
    shard,
    resume: !!a.resume,
    chunkSize: Number(one('chunk', '250')),
    logsBelow: Number(one('logs', '0')),
    policyParams,
    quiet: !!a.quiet,
    workers: Number(one('workers', String(defaultWorkers()))),
  };
}

export async function main(argv: string[]): Promise<RunSummary | null> {
  let cfg: ReturnType<typeof configFromArgs>;
  try {
    cfg = configFromArgs(argv);
  } catch (e) {
    if (e instanceof HelpRequested) {
      console.log(HELP);
      return null;
    }
    throw e;
  }
  for (const b of cfg.bots)
    if (!STRATEGY_IDS.includes(b.split('@')[0]))
      throw new Error(`Unknown bot "${b}". Known: ${STRATEGY_IDS.join(', ')}`);
  const pool = new Pool(cfg.workers);
  const t0 = Date.now();
  try {
    const { complete, dir } = await runSim(cfg, pool, (p) => {
      if (!cfg.quiet)
        process.stderr.write(
          `\r${cfg.name}: chunk ${p.done}/${p.total} (${p.skipped} on disk) ${(p.ms / 1000).toFixed(1)}s   `,
        );
    });
    if (!cfg.quiet) process.stderr.write('\n');
    if (!complete) {
      console.log(`Shard done; run not complete yet (other shards pending). Output: ${dir}`);
      return null;
    }
    const s = JSON.parse(readFileSync(path.join(dir, 'summary.json'), 'utf8')) as RunSummary;
    if (!cfg.quiet) console.log(printSummary(s));
    console.log(`\n${cfg.name}: done in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${dir}`);
    return s;
  } finally {
    await pool.close();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('sim', 'src', 'cli.ts'));
if (isMain)
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
