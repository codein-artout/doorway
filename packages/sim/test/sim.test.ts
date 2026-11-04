import { describe, expect, it, beforeAll } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_RULESET } from '@doorway/content';
import { Pool } from '../src/pool';
import { runSim, type SimConfig } from '../src/run';
import { configFromArgs } from '../src/cli';
import { studyRuns } from '../src/study';
import { aggregate } from '../src/aggregate';
import { renderMarkdown } from '../src/report/markdown';
import { renderHtml } from '../src/report/html';
import { buildModel } from '../src/report/model';
import { seatsFor, permutations } from '../src/schedule';
import { wilson, logistic } from '../src/stats';

const tmp = () => mkdtempSync(path.join(os.tmpdir(), 'doorway-sim-'));
const gz = (f: string) => gunzipSync(readFileSync(f)).toString('utf8');

const base = (outDir: string, o: Partial<SimConfig> = {}): SimConfig => ({
  name: 'test',
  outDir,
  players: 3,
  bots: ['greedy', 'tempo', 'specialist'],
  seats: 'rotate',
  games: 60,
  seed: 'unit',
  ruleset: DEFAULT_RULESET,
  chunkSize: 20,
  ...o,
});

describe('Simulator CLI', () => {
  it('parses spec §7 arguments (dotted sweeps separated by ;, shards, resume)', () => {
    const c = configFromArgs([
      '--players',
      '4',
      '--bots',
      'tempo,specialist,lookahead,greedy',
      '--games',
      '10000',
      '--seats',
      'rotate',
      '--seed',
      'doorway-2026',
      '--ruleset',
      'v0.2-default',
      '--sweep',
      'doorway.4=9,8,7,6;10,7,5,3',
      '--workers',
      '4',
      '--shard',
      '1/8',
      '--resume',
      '--out',
      'reports/runs/x',
    ]);
    expect(c).toMatchObject({
      players: 4,
      games: 10000,
      seats: 'rotate',
      seed: 'doorway-2026',
      workers: 4,
      resume: true,
      outDir: 'reports/runs/x',
      shard: { index: 1, count: 8 },
    });
    expect(c.sweep).toEqual({ key: 'doorway.4', values: ['9,8,7,6', '10,7,5,3'] });
    expect(() => configFromArgs(['--seats', 'sideways'])).toThrow();
  });
  it('seat modes: rotate, fixed, all-permutations, field', () => {
    expect(seatsFor('fixed', ['a', 'b', 'c'], 3, 5, 's')).toEqual(['a', 'b', 'c']);
    expect(seatsFor('rotate', ['a', 'b', 'c'], 3, 1, 's')).toEqual(['b', 'c', 'a']);
    const perms = new Set(
      Array.from({ length: 6 }, (_, g) => seatsFor('all-permutations', ['a', 'b', 'c'], 3, g, 's').join()),
    );
    expect(perms.size).toBe(6);
    expect(permutations([1, 2, 3, 4]).length).toBe(24);
    expect(seatsFor('field', ['a', 'b'], 4, 3, 's')).toEqual(seatsFor('field', ['a', 'b'], 4, 3, 's'));
  });
  it('same arguments give identical output; shards + resume reproduce the unsharded run', async () => {
    const pool = new Pool(2);
    try {
      const a = tmp(),
        b = tmp(),
        c = tmp();
      await runSim(base(a, { sweep: { key: 'doorway.3', values: ['9,8,7', '10,7,5'] } }), pool);
      await runSim(base(b, { sweep: { key: 'doorway.3', values: ['9,8,7', '10,7,5'] } }), pool);
      expect(gz(path.join(a, 'games.csv.gz'))).toBe(gz(path.join(b, 'games.csv.gz')));
      expect(gz(path.join(a, 'players.csv.gz'))).toBe(gz(path.join(b, 'players.csv.gz')));
      const r1 = await runSim(
        base(c, {
          sweep: { key: 'doorway.3', values: ['9,8,7', '10,7,5'] },
          shard: { index: 1, count: 2 },
          resume: true,
        }),
        pool,
      );
      expect(r1.complete).toBe(false);
      const r2 = await runSim(
        base(c, {
          sweep: { key: 'doorway.3', values: ['9,8,7', '10,7,5'] },
          shard: { index: 2, count: 2 },
          resume: true,
        }),
        pool,
      );
      expect(r2.complete).toBe(true);
      expect(gz(path.join(c, 'players.csv.gz'))).toBe(gz(path.join(a, 'players.csv.gz')));
      const games = gz(path.join(a, 'games.csv.gz')).trim().split('\n');
      expect(games.length).toBe(1 + 120);
      expect(games[1]).toContain('doorway.3=9/8/7');
      const head = gz(path.join(a, 'players.csv.gz')).split('\n')[0];
      for (const col of [
        'total',
        'cards',
        'full_life',
        'passion',
        'reflection',
        'arrival',
        'tower',
        'lost',
        'rushes',
        'extra_turns',
        'saved_exp',
        'used_age_reach',
      ])
        expect(head.split(',')).toContain(col);
      expect(existsSync(path.join(a, 'picks.csv.gz'))).toBe(true);
      for (const d of [a, b, c]) rmSync(d, { recursive: true, force: true });
    } finally {
      await pool.close();
    }
  });
  it('stats: Wilson intervals and logistic regression behave', () => {
    const w = wilson(25, 100);
    expect(w.p).toBe(0.25);
    expect(w.lo).toBeGreaterThan(0.17);
    expect(w.hi).toBeLessThan(0.35);
    const X = Array.from({ length: 400 }, (_, i) => [((i * 37) % 100) / 50 - 1]);
    const y = X.map(([x], i) => (x + ((i * 13) % 7) / 10 - 0.3 > 0 ? 1 : 0));
    expect(logistic(X, y)[1]).toBeGreaterThan(1);
  });
});

describe('Study → aggregate → report (miniature)', () => {
  let summary: Awaited<ReturnType<typeof aggregate>>;
  const runs = tmp();
  const data = tmp();
  beforeAll(async () => {
    const pool = new Pool(3);
    try {
      for (const r of studyRuns({ scale: 0.004, strategies: ['random', 'greedy', 'tempo', 'specialist'] }))
        await runSim(
          { ...r, ruleset: DEFAULT_RULESET, outDir: path.join(runs, r.name), resume: true, quiet: true },
          pool,
        );
    } finally {
      await pool.close();
    }
    summary = await aggregate({ runs, data, quiet: true });
  }, 300_000);
  it('writes the reports/data files', () => {
    for (const f of [
      'games.csv.gz',
      'players.csv.gz',
      'cards.csv',
      'matchups.csv',
      'sweeps.csv',
      'summary.json',
      'logs-sample.jsonl.gz',
    ])
      expect(existsSync(path.join(data, f))).toBe(true);
    expect(summary.totals.byStudy).toHaveProperty('S1');
    expect(summary.totals.byStudy).toHaveProperty('S5');
  });
  it('RB-13.W1 R4: Doorway relevance is measured — discs lost by arrival order and player count', () => {
    const g = summary.groups['main-4p'];
    expect(Object.keys(g.byArrival).sort()).toEqual(['1', '2', '3', '4']);
    expect(g.byArrival['1']).toHaveProperty('lost');
    expect(g.byArrival['1']).toHaveProperty('shareLostAny');
    expect(typeof g.nonFirstLost).toBe('number');
    const md = renderMarkdown(summary);
    expect(md.indexOf('Does arriving first make the Doorway irrelevant?')).toBeLessThan(md.indexOf('## 2.'));
  });
  it('RB-13.W2: specialist snowball is measured — experience savings, engine acceleration, strategy win rates', () => {
    const g = summary.groups['main-4p'];
    expect(g.savedExperience.mean).toBeGreaterThanOrEqual(0);
    expect(g.costByLifeQuarter.length).toBe(4);
    expect(g.byPolicy.specialist.win).toBeGreaterThanOrEqual(0);
  });
  it('RB-13.W3 R45: seat advantage is reported in percentage points and relative to fair share', () => {
    const seat1 = summary.groups['main-3p'].bySeat['1'];
    expect(seat1).toHaveProperty('diffPP');
    expect(seat1).toHaveProperty('diffRel');
    expect(seat1.diffRel).toBeCloseTo(seat1.win / seat1.fair - 1, 3);
    const m = buildModel(summary);
    const r = m.readyToPrint.find((x) => x.signal.includes('first-seat') && x.signal.includes('4p'))!;
    expect(r.value).toMatch(/pts/);
    expect(r.value).toMatch(/relative/);
    expect(renderMarkdown(summary)).toMatch(/pass\/fail uses percentage points/);
  });
  it('RB-13.W4: stale markets are measured — turns with no takeable quest', () => {
    expect(summary.groups['main-4p'].noQuestTurns).toHaveProperty('mean');
  });
  it('report: ANALYSIS.md opens with plain answers and covers sections 1–12; HTML is self-contained', () => {
    const md = renderMarkdown(summary);
    expect(md.split('\n').slice(0, 8).join('\n')).toMatch(/Plain-language answers/);
    for (let i = 1; i <= 12; i++) expect(md).toContain(`## ${i}.`);
    const html = renderHtml(summary);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).not.toMatch(/<script\b|https?:\/\/(?!www\.w3\.org)/);
    expect(html).toContain('<svg');
  });
  it('the sample move logs replay', () => {
    const line = gz(path.join(data, 'logs-sample.jsonl.gz')).split('\n')[0];
    expect(JSON.parse(line).replay.format).toBe('doorway-replay@1');
  });
});
