import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPolicy, makeBotView } from '@doorway/bots';
import { CARDS, DEFAULT_RULESET } from '@doorway/content';
import { apply, botSeed, currentPlayer, init, legalMoves, Rng, type GameState } from '@doorway/engine';
import { turnPoints } from '../src/lib/analyst-model';
import {
  economy,
  finalTable,
  kpis,
  playedMostLike,
  trimStudy,
  turningPoints,
  vsStudy,
} from '../src/lib/report-model';
import { allowanceLine, sensitivity, windowDetail, windowTable } from '../src/lib/window-model';

/** A whole 3-player bot game, every state kept (the report's input). */
function botGame(seed = 'report-test'): GameState[] {
  const players = [
    { id: 'p1', name: 'Priya', isBot: true, botPolicy: 'tempo' },
    { id: 'p2', name: 'Arun', isBot: true, botPolicy: 'specialist' },
    { id: 'p3', name: 'Meera', isBot: true, botPolicy: 'greedy' },
  ];
  const states = [init(DEFAULT_RULESET, CARDS, players, seed)];
  for (let guard = 0; guard < 2000; guard++) {
    const s = states[states.length - 1];
    if (s.phase === 'over') break;
    // windows first (bots choose theirs at once), then the turn player
    const waiting = s.players.find((p) => p.arrivalOrder !== null && p.keptRange === null);
    const pid = waiting && s.phase !== 'pending_choice' ? waiting.id : currentPlayer(s)!;
    const p = s.players.find((x) => x.id === pid)!;
    const rng = Rng.fromSeed(`${botSeed(s.seed, p.seat, p.botPolicy!)}|m${s.moves.length}`);
    const view = makeBotView(s, pid);
    const move = view.legal.length ? getPolicy(p.botPolicy!).choose(view, rng) : legalMoves(s, pid)[0];
    states.push(apply(s, move, pid).state);
  }
  return states;
}

describe('window scorer (DESIGN-v2 §4)', () => {
  const states = botGame();
  const last = states[states.length - 1];
  const p = last.players.find((x) => x.tower.length > (x.doorwayAllowance ?? 0))!;

  it('lists every maximal window with one best, and explains the selected one', () => {
    const { rows, allowance } = windowTable(last, p.id);
    expect(rows).toHaveLength(p.tower.length - Math.min(allowance, p.tower.length) + 1);
    expect(rows.filter((r) => r.best)).toHaveLength(1);
    const d = windowDetail(last, p.id, rows[0]);
    expect(d.label).toBe(`1–${rows[0].end + 1}`);
    expect(d.domCounts.split(' · ')).toHaveLength(5);
    expect(d.lost.startsWith(`${p.tower.length - rows[0].kept}:`)).toBe(true);
  });

  it('allowance sensitivity: 10 down to 6, best score never rises as the allowance shrinks', () => {
    const sens = sensitivity(last, p.id);
    expect(sens.map((x) => x.keep)).toEqual([10, 9, 8, 7, 6]);
    for (let i = 1; i < sens.length; i++) expect(sens[i].score).toBeLessThanOrEqual(sens[i - 1].score);
    expect(sens.filter((x) => x.mine).length).toBeLessThanOrEqual(1);
  });

  it('header line names the arrival, the tile and the allowance', () => {
    expect(allowanceLine(last, p.id)).toMatch(new RegExp(`^${p.name} arrived \\d(st|nd|rd|th) · tile \\d+`));
  });
});

describe('game report (DESIGN-v2 §4)', () => {
  const states = botGame();
  const last = states[states.length - 1];
  const tl = { states, thinkMs: states.map((_, i) => (i ? 40 : null)) };
  const points = turnPoints(tl);

  it('final table: totals match the engine score, ranked, kept + lost = tower', () => {
    const rows = finalTable(last, null);
    expect(rows.map((r) => r.rank)).toEqual([...rows.map((r) => r.rank)].sort((a, b) => a - b));
    for (const r of rows) {
      expect(r.kept + r.lost).toBe(r.tower);
      expect(r.cards + r.fullLife + r.passion + r.reflection).toBe(r.total);
      expect(r.win).toMatch(/best|vs/);
    }
  });

  it('KPIs and turn economy agree with the timeline', () => {
    const k = kpis(last, points);
    expect(k.map((x) => x.label)).toEqual(['Winner', 'Length', 'Discs lost', 'Back-to-back turns', 'Rushes']);
    expect(k[1].value).toBe(`${points.length - 1} turns`);
    const eco = economy(last, points, states);
    expect(eco.reduce((a, e) => a + e.turns, 0)).toBe(points.length - 1);
    expect(eco.every((e) => e.think === '40 ms')).toBe(true);
  });

  it('played most like: a bot agrees with its own strategy on every decision', () => {
    const styles = playedMostLike(last, points);
    const tempo = styles.find((x) => x.name === 'Priya')!;
    expect(tempo.bars[0]).toMatchObject({ id: 'tempo', v: 1 });
    const greedy = styles.find((x) => x.name === 'Meera')!;
    expect(greedy.bars[0]).toMatchObject({ id: 'greedy', v: 1 });
    for (const st of styles) for (const b of st.bars) expect(b.v).toBeGreaterThanOrEqual(0);
  });

  it('turning points are sorted by move and link inside the game', () => {
    const tp = turningPoints(states, points);
    for (let i = 1; i < tp.length; i++) expect(tp[i].move).toBeGreaterThanOrEqual(tp[i - 1].move);
    for (const x of tp) {
      expect(x.move).toBeGreaterThan(0);
      expect(x.move).toBeLessThanOrEqual(last.moves.length);
    }
    // every arrival either kept everything, lost 3+, or is not a turning point
    const arrivals = tp.filter((x) => /arrived/.test(x.text));
    for (const a of arrivals) expect(a.effect).toMatch(/^(0 lost|−\d+ discs)$/);
  });

  it('this game vs the study reads the committed summary.json', () => {
    const summary = JSON.parse(
      readFileSync(path.join(__dirname, '../../../reports/data/summary.json'), 'utf8'),
    );
    const study = trimStudy(summary)!;
    expect(Object.keys(study.groups)).toEqual(['2p', '3p', '4p']);
    expect(study.groups['4p'].turnsPerGame).toBeCloseTo(summary.groups['main-4p'].turnsPerGame.mean);
    const vs = vsStudy(last, points, study);
    expect(vs[0]).toEqual({
      m: 'Turns per game',
      g: String(points.length - 1),
      s: study.groups['3p'].turnsPerGame.toFixed(1),
    });
    expect(vsStudy(last, points, null).every((r) => r.s === '—')).toBe(true);
  });
});
