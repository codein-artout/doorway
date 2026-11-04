#!/usr/bin/env node
// v2 simulation regression check (BUILD_PROMPT-v2 §2).
// Runs the fixed sim and compares its game/player/pick outputs to the committed N1 baseline fingerprint
// (and, when present, byte-for-byte to reports/runs/v2-before).
//   node scripts/regression/check.mjs                 → run into reports/runs/v2-after and compare
//   node scripts/regression/check.mjs --write-baseline → record the fingerprint from reports/runs/v2-before
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FILES = ['games.csv.gz', 'players.csv.gz', 'picks.csv.gz'];
const ARGS = ['--players', '4', '--games', '1000', '--bots', 'greedy,tempo,specialist,generalist', '--seed', 'v2-regress', '--quiet'];
const baselineFile = path.join(root, 'scripts/regression/v2-baseline.json');

const fingerprint = (dir) => Object.fromEntries(FILES.map((f) => [f, createHash('sha256').update(gunzipSync(readFileSync(path.join(dir, f)))).digest('hex')]));

function runSim(out) {
  rmSync(path.join(root, out), { recursive: true, force: true });
  const r = spawnSync(process.execPath, ['--import', 'tsx', path.join(root, 'packages/sim/src/cli.ts'), ...ARGS, '--out', out], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stdout, r.stderr);
    process.exit(1);
  }
}

if (process.argv.includes('--write-baseline')) {
  const dir = path.join(root, 'reports/runs/v2-before');
  if (!existsSync(dir)) runSim('reports/runs/v2-before');
  writeFileSync(baselineFile, JSON.stringify({ args: ARGS, files: fingerprint(dir) }, null, 2) + '\n');
  console.log('regression: baseline written', baselineFile);
  process.exit(0);
}

const out = 'reports/runs/v2-after';
runSim(out);
const now = fingerprint(path.join(root, out));
const base = JSON.parse(readFileSync(baselineFile, 'utf8')).files;
let ok = true;
for (const f of FILES)
  if (now[f] !== base[f]) {
    ok = false;
    console.error(`regression: ${f} differs from the N1 baseline (${now[f].slice(0, 12)} vs ${base[f].slice(0, 12)})`);
  }
const before = path.join(root, 'reports/runs/v2-before');
if (existsSync(before))
  for (const f of FILES) {
    const a = gunzipSync(readFileSync(path.join(before, f))).toString();
    const b = gunzipSync(readFileSync(path.join(root, out, f))).toString();
    if (a !== b) {
      ok = false;
      console.error(`regression: ${f} is not byte-identical to reports/runs/v2-before`);
    }
  }
if (!ok) process.exit(1);
console.log(`regression: identical to the N1 baseline (${FILES.join(', ')})`);
