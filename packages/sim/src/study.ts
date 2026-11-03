#!/usr/bin/env tsx
// pnpm sim:study — the full balance study (S1–S5), resumable and time-boxed.
//
//   pnpm sim:study                      # everything, then aggregate
//   tsx packages/sim/src/study.ts --budget-min 22 --workers 3     # background slice; rerun to continue
//   tsx packages/sim/src/study.ts --only S1 --list                # show the plan

import { existsSync } from 'node:fs';
import path from 'node:path';
import { STRATEGY_IDS } from '@doorway/bots';
import { DEFAULT_RULESET } from '@doorway/content';
import { Rng } from '@doorway/engine';
import { defaultWorkers, Pool } from './pool';
import { runSim, type SimConfig } from './run';
import { permutations } from './schedule';

export const RUNS_DIR = path.join('reports', 'runs');
export const STUDY_SEED = 'doorway-2026';
/** S4 field: lookahead at a reduced budget (recorded in DECISIONS.md D-SIM-3). */
export const S4_LOOKAHEAD = { determinizations: 4, maxCandidates: 5 };

type StudyRun = Omit<SimConfig, 'outDir' | 'ruleset'> & { study: string };

function kPerms(ids: string[], k: number): string[][] {
  const out: string[][] = [];
  const rec = (cur: string[]) => {
    if (cur.length === k) return void out.push(cur.slice());
    for (const id of ids) if (!cur.includes(id)) rec([...cur, id]);
  };
  rec([]);
  return out;
}

export function studyRuns(): StudyRun[] {
  const all = STRATEGY_IDS; // 11
  const field = all.filter((x) => x !== 'random'); // 10
  const runs: StudyRun[] = [];
  // S1 — 2p round robin: 121 ordered pairs × 1,000
  for (const a of all)
    for (const b of all)
      runs.push({
        study: 'S1',
        name: `S1-${a}-vs-${b}`,
        players: 2,
        bots: [a, b],
        seats: 'fixed',
        games: 1000,
        seed: `${STUDY_SEED}-S1`,
        chunkSize: 250,
        logsBelow: 4,
      });
  // S2 — 3p and 4p: every combination of distinct strategies in every seat order
  const p3 = kPerms(all, 3); // 990
  const p4 = kPerms(all, 4); // 7,920
  runs.push({
    study: 'S2',
    name: 'S2-3p-all-seatings',
    players: 3,
    bots: all,
    seats: 'fixed',
    seatList: p3,
    games: p3.length * 11,
    seed: `${STUDY_SEED}-S2-3p`,
    chunkSize: 330,
    logsBelow: 100,
  });
  runs.push({
    study: 'S2',
    name: 'S2-4p-all-seatings',
    players: 4,
    bots: all,
    seats: 'fixed',
    seatList: p4,
    games: p4.length * 2,
    seed: `${STUDY_SEED}-S2-4p`,
    chunkSize: 330,
    logsBelow: 200,
  });
  // S3 — noisy field: every strategy at ε 0.1, 4p, seats uniform over the 11
  runs.push({
    study: 'S3',
    name: 'S3-noisy-field-4p',
    players: 4,
    bots: all.map((x) => `${x}@eps0.1`),
    seats: 'field',
    games: 10_000,
    seed: `${STUDY_SEED}-S3`,
    chunkSize: 250,
    logsBelow: 100,
  });
  // S4 — sweeps on a uniform field of the 10 non-random strategies (lookahead at a reduced budget)
  const sweeps: [string, number, string[]][] = [
    ['doorway.4', 4, ['9,8,7,6', '10,7,5,3', '8,7,6,5', '9,7,5,3', '10,8,6,4']],
    ['doorway.3', 3, ['9,8,7', '10,7,5', '9,7,5', '8,7,6']],
    ['doorway.2', 2, ['9,7', '10,6', '9,6', '8,7']],
    ['experienceCap', 4, ['2', '3', '4', '99']],
    ['fullLifeBonus', 4, ['4', '6', '8', '10']],
    ['passion', 4, ['2,4,7', '3,6,10', '4,8,14']],
  ];
  for (const [key, n, values] of sweeps)
    runs.push({
      study: 'S4',
      name: `S4-sweep-${key}`,
      players: n,
      bots: field,
      seats: 'field',
      games: 10_000,
      seed: `${STUDY_SEED}-S4`,
      sweep: { key, values },
      chunkSize: 500,
      logsBelow: 25,
      policyParams: { lookahead: S4_LOOKAHEAD },
    });
  // S4 confirmation — 2k games per value, every game includes a full-budget lookahead seat
  for (const [key, n, values] of sweeps.filter(([k]) => k === 'doorway.4' || k === 'experienceCap')) {
    const rng = Rng.fromSeed(`S4C|${key}`);
    const others = field.filter((x) => x !== 'lookahead');
    const seatList = Array.from({ length: 2000 }, (_, g) => {
      const seats = Array.from({ length: n }, () => rng.pick(others));
      seats[g % n] = 'lookahead';
      return seats;
    });
    runs.push({
      study: 'S4C',
      name: `S4C-confirm-${key}`,
      players: n,
      bots: field,
      seats: 'fixed',
      seatList,
      games: 2000,
      seed: `${STUDY_SEED}-S4C`,
      sweep: { key, values },
      chunkSize: 250,
      logsBelow: 0,
    });
  }
  // S5 — solo: 2,000 games per strategy
  for (const a of all)
    runs.push({
      study: 'S5',
      name: `S5-solo-${a}`,
      players: 1,
      bots: [a],
      seats: 'fixed',
      games: 2000,
      seed: `${STUDY_SEED}-S5`,
      chunkSize: 500,
      logsBelow: 4,
    });
  return runs;
}

export const isComplete = (name: string) => existsSync(path.join(RUNS_DIR, name, 'COMPLETE'));

async function main(argv: string[]) {
  const arg = (k: string) => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const budgetMin = Number(arg('budget-min') ?? 'Infinity');
  const workers = Number(arg('workers') ?? defaultWorkers());
  const only = arg('only')?.split(',');
  const shard = arg('shard')?.split('/').map(Number);
  let runs = studyRuns();
  if (only) runs = runs.filter((r) => only.includes(r.study) || only.includes(r.name));
  if (shard) runs = runs.filter((_, i) => i % shard[1] === shard[0] - 1);
  if (argv.includes('--list')) {
    for (const r of runs)
      console.log(
        `${isComplete(r.name) ? 'done' : 'todo'}  ${r.study.padEnd(4)} ${r.name.padEnd(44)} ${r.players}p × ${r.games}${r.sweep ? ` × ${r.sweep.values.length} values` : ''}`,
      );
    const total = runs.reduce((s, r) => s + r.games * (r.sweep?.values.length ?? 1), 0);
    console.log(
      `${runs.length} runs, ${total.toLocaleString()} games; ${runs.filter((r) => isComplete(r.name)).length} complete`,
    );
    return;
  }
  const pool = new Pool(workers);
  const t0 = Date.now();
  let ran = 0;
  try {
    for (const r of runs) {
      if (isComplete(r.name)) continue;
      if ((Date.now() - t0) / 60000 > budgetMin) {
        console.log(`Budget of ${budgetMin} min reached; rerun to continue.`);
        break;
      }
      const t1 = Date.now();
      const res = await runSim(
        { ...r, ruleset: DEFAULT_RULESET, outDir: path.join(RUNS_DIR, r.name), resume: true, quiet: true },
        pool,
      );
      ran++;
      console.log(
        `${new Date().toISOString()} ${r.name}: ${res.complete ? 'complete' : 'partial'} in ${((Date.now() - t1) / 1000).toFixed(1)}s`,
      );
    }
  } finally {
    await pool.close();
  }
  const left = studyRuns().filter((r) => !isComplete(r.name)).length;
  console.log(
    `Study slice finished: ${ran} runs this slice, ${left} runs left overall, ${((Date.now() - t0) / 60000).toFixed(1)} min.`,
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('sim', 'src', 'study.ts'));
if (isMain)
  main(process.argv.slice(2)).catch((e) => {
    console.error(e);
    process.exit(1);
  });

export { permutations };
